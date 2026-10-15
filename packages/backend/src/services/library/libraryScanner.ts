import path from "path";
import * as mm from "music-metadata";
import { storageDb, tracksDb, catalogSyncDb } from "@repo/db";
import type { MPDTrack } from "@repo/types";
import type { LogService } from "@services/utils/logService";
import {
  getAudioExtensions,
  walk,
  type SourceFile,
} from "@services/storage/storageStats";
import { mapAudioMetadata } from "@services/library/audioMetadata";

// music-metadata is ESM: its namespace object is immutable, so sinon cannot
// stub `mm.parseFile` directly. Routing calls through this mutable object
// gives tests a seam to count parses without changing runtime behavior.
export const mediaMetadata = { parseFile: mm.parseFile };

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
};

function isUnderPrefix(file: string, prefix: string): boolean {
  if (prefix === "" || prefix === ".") return true;
  return file === prefix || file.startsWith(prefix + path.sep);
}

export class LibraryScanner {
  constructor(private readonly logService: LogService) {}

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
      try {
        ({ files, dirCount } = walk(source.path, extensions));
      } catch (err) {
        this.logService.pushLog(
          "warn",
          `Scanner could not read source "${source.name}" (${source.path}); keeping its catalog rows`,
          { error: err instanceof Error ? err.message : err },
        );
        continue;
      }

      let totalSize = 0;
      for (const file of files) totalSize += file.size;

      walked.push({
        id: source.id,
        prefix: path.relative(musicDir, source.path),
        files,
        dirCount,
        totalSize,
      });
      totalFiles += files.length;
    }

    const liveFiles = new Set<string>();
    const upserts: MPDTrack[] = [];
    let inspected = 0;

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
          continue;
        }

        const fallbackTitle = path.parse(file.file).name;
        try {
          const metadata = await mediaMetadata.parseFile(absPath, {
            duration: true,
          });
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

    const deletions = this.buildDeletions(walked, liveFiles);

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

  private buildDeletions(
    walked: WalkedSource[],
    liveFiles: Set<string>,
  ): string[] {
    const dbFiles = tracksDb.getFiles();
    const underWalked = (file: string): boolean =>
      walked.some((source) => isUnderPrefix(file, source.prefix));

    // First run: legacy/MPD-sourced rows cannot be attributed to a source
    // prefix, so drop everything not seen by a walked source. Never wipe when
    // nothing was walked (unreadable/absent sources must not delete data).
    if (catalogSyncDb.getScannerVersion() === undefined) {
      if (walked.length === 0) return [];
      return dbFiles.filter((file) => !liveFiles.has(file));
    }

    return dbFiles.filter((file) => underWalked(file) && !liveFiles.has(file));
  }
}
