import path from "path";
import * as mm from "music-metadata";
import { storageDb, tracksDb, catalogSyncDb } from "@repo/db";
import type { MPDTrack } from "@repo/types";
import type { LogService } from "@services/utils/logService";
import {
  getAudioExtensions,
  walk,
  type SourceFile,
  type WalkSkip,
} from "@services/storage/storageStats";
import { mapAudioMetadata } from "@services/library/audioMetadata";

export type ParseFileFn = (
  filePath: string,
  options?: mm.IOptions,
) => Promise<mm.IAudioMetadata>;

export type ScanProgress = {
  phase: "tracks";
  current: number;
  total: number;
};

export type ScanResult = {
  synced: number;
  deleted: number;
  errors: number;
};

type WalkedSource = {
  id: number;
  prefix: string;
  files: SourceFile[];
  dirCount: number;
  totalSize: number;
  skipped: WalkSkip[];
};

function isUnderPrefix(file: string, prefix: string): boolean {
  if (prefix === "" || prefix === ".") return true;
  return file === prefix || file.startsWith(prefix + path.sep);
}

export class LibraryScanner {
  constructor(
    private readonly logService: LogService,
    private readonly parseFile: ParseFileFn = (filePath, options) =>
      mm.parseFile(filePath, options),
  ) {}

  async scan(onProgress?: (p: ScanProgress) => void): Promise<ScanResult> {
    // Read MUSIC_DIR at scan time so tests (and hot config reloads) can
    // redirect the root without re-importing the module.
    const musicDir = process.env.MUSIC_DIR ?? "/opt/sonect/music";
    const extensions = getAudioExtensions();
    const sources = storageDb.getAll().filter((source) => source.enabled);

    const walked: WalkedSource[] = [];
    let totalFiles = 0;

    for (const source of sources) {
      let files: SourceFile[];
      let dirCount: number;
      let skipped: WalkSkip[];
      try {
        ({ files, dirCount, skipped } = walk(source.path, extensions));
      } catch (err) {
        this.logService.pushLog(
          "warn",
          `Scanner could not read source "${source.name}" (${source.path}); keeping its catalog rows`,
          { error: err instanceof Error ? err.message : err },
        );
        continue;
      }

      if (skipped.length > 0) {
        this.logSkips(source.name, skipped, musicDir);
      }

      let totalSize = 0;
      for (const file of files) totalSize += file.size;

      walked.push({
        id: source.id,
        prefix: path.relative(musicDir, source.path),
        files,
        dirCount,
        totalSize,
        skipped,
      });
      totalFiles += files.length;
    }

    // No readable source was walked: bail out before `applyIncremental` so the
    // one-time `scanner_version` marker is not spent while the legacy-row
    // cleanup cannot run. This also guarantees nothing is ever deleted here.
    if (walked.length === 0) {
      this.logService.pushLog(
        "info",
        "Library scan skipped: no readable storage sources",
      );
      return { synced: 0, deleted: 0, errors: 0 };
    }

    const liveFiles = new Set<string>();
    const upserts: MPDTrack[] = [];
    let inspected = 0;
    let newCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;

    for (const source of walked) {
      for (const file of source.files) {
        inspected += 1;
        onProgress?.({
          phase: "tracks",
          current: inspected,
          total: totalFiles,
        });

        const absPath = path.join(musicDir, source.prefix, file.file);
        const rel = path.relative(musicDir, absPath);
        liveFiles.add(rel);

        const existing = tracksDb.getByFile(rel);
        if (
          existing &&
          existing.mtime === file.mtimeMs &&
          existing.size === file.size
        ) {
          unchangedCount += 1;
          continue;
        }

        if (existing) {
          updatedCount += 1;
        } else {
          newCount += 1;
        }

        this.logService.pushLog(
          "debug",
          existing
            ? `Scanner updated track: ${rel}`
            : `Scanner found new track: ${rel}`,
        );

        const fallbackTitle = path.parse(file.file).name;
        try {
          const metadata = await this.parseFile(absPath, { duration: true });
          upserts.push(
            mapAudioMetadata(
              {
                file: rel,
                mtimeMs: file.mtimeMs,
                size: file.size,
                common: metadata.common,
                format: metadata.format,
              },
              fallbackTitle,
            ),
          );
        } catch (err) {
          this.logService.pushLog(
            "warn",
            `Scanner could not read metadata for ${rel}; indexing by filename`,
            { error: err instanceof Error ? err.message : err },
          );
          upserts.push(
            mapAudioMetadata(
              { file: rel, mtimeMs: file.mtimeMs, size: file.size },
              fallbackTitle,
            ),
          );
        }
      }
    }

    const deletions = this.buildDeletions(musicDir, walked, liveFiles);

    for (const file of deletions) {
      this.logService.pushLog("debug", `Scanner removed track: ${file}`);
    }

    this.logService.pushLog(
      "debug",
      `Scanner inspected ${liveFiles.size} files: ${newCount} new, ${updatedCount} updated, ${unchangedCount} unchanged, ${deletions.length} removed`,
    );

    const result = catalogSyncDb.applyIncremental({ upserts, deletions });

    for (const source of walked) {
      storageDb.updateStats(source.id, {
        file_count: source.files.length,
        dir_count: source.dirCount,
        total_size: source.totalSize,
      });
    }

    this.logService.pushLog(
      "info",
      `Library scan finished: ${result.synced} synced, ${result.deleted} deleted, ${result.errors} errors`,
    );

    return result;
  }

  /**
   * Report subtrees the walk had to skip. A non-UTF-8 name means the share's
   * filename charset needs fixing upstream; until then the entry cannot be
   * addressed by path, so it is reported (with the raw latin-1 name) and left
   * out of the catalog and stats.
   */
  private logSkips(
    sourceName: string,
    skipped: WalkSkip[],
    musicDir: string,
  ): void {
    const MAX_DETAILED = 5;
    for (const skip of skipped.slice(0, MAX_DETAILED)) {
      const rel = path.relative(musicDir, skip.path) || ".";
      const detail =
        skip.reason === "encoding"
          ? `non-UTF-8 name(s)${skip.sample === undefined ? "" : ` (raw: "${skip.sample}")`}`
          : `unreadable${skip.code === undefined ? "" : ` (${skip.code})`}`;
      this.logService.pushLog(
        "warn",
        `Scanner skipped "${rel}": ${detail}; keeping its catalog rows and excluding it from stats`,
      );
    }
    if (skipped.length > MAX_DETAILED) {
      this.logService.pushLog(
        "warn",
        `Scanner skipped ${skipped.length - MAX_DETAILED} more entries under "${sourceName}"; keeping their catalog rows`,
      );
    }
  }

  private buildDeletions(
    musicDir: string,
    walked: WalkedSource[],
    liveFiles: Set<string>,
  ): string[] {
    const dbFiles = tracksDb.getFiles();
    const underWalked = (file: string): boolean =>
      walked.some((source) => isUnderPrefix(file, source.prefix));
    const skippedPrefixes = walked.flatMap((source) =>
      source.skipped.map((skip) => path.relative(musicDir, skip.path)),
    );
    const underSkipped = (file: string): boolean =>
      skippedPrefixes.some((prefix) => isUnderPrefix(file, prefix));

    // First run: legacy/MPD-sourced rows cannot be attributed to a source
    // prefix by being live, so clean up conservatively. Delete a row only when
    // it is under a walked prefix that dropped it (steady-state rule) or when
    // it is under no registered source prefix at all (true orphans/legacy
    // rows). A row under a registered-but-unwalked (unreadable) or disabled
    // source is never touched. `scan()` returns early when nothing was walked,
    // so this only runs with ≥1 walked source.
    if (catalogSyncDb.getScannerVersion() === undefined) {
      const allSourcePrefixes = storageDb
        .getAll()
        .map((source) => path.relative(musicDir, source.path));
      const underAnyRegistered = (file: string): boolean =>
        allSourcePrefixes.some((prefix) => isUnderPrefix(file, prefix));

      return dbFiles.filter(
        (file) =>
          !liveFiles.has(file) &&
          !underSkipped(file) &&
          (underWalked(file) || !underAnyRegistered(file)),
      );
    }

    return dbFiles.filter(
      (file) =>
        underWalked(file) && !liveFiles.has(file) && !underSkipped(file),
    );
  }
}
