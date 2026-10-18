import fs from "fs";
import path from "path";

const DEFAULT_EXTENSIONS =
  "mp3,flac,ogg,oga,opus,m4a,aac,wav,wma,ape,wv,dsf,dff,mpc,tta";

export interface SourceStats {
  file_count: number;
  dir_count: number;
  total_size: number;
}

export interface SourceFile {
  file: string;
  mtimeMs: number;
  size: number;
}

export interface WalkSkip {
  /**
   * Absolute prefix to protect from deletion: the skipped directory itself for
   * "unreadable", or the parent directory for "encoding" (the DB form of a
   * legacy row under an undecodable entry is unknowable).
   */
  path: string;
  reason: "unreadable" | "encoding";
  /** errno code, when reason is "unreadable". */
  code?: string;
  /** Raw entry name decoded as latin-1, for diagnostics when reason is "encoding". */
  sample?: string;
}

export interface WalkResult {
  files: SourceFile[];
  dirCount: number;
  skipped: WalkSkip[];
}

/**
 * Decode a raw directory entry name. Returns undefined when the bytes are not
 * valid UTF-8: Node would decode them lossily to U+FFFD, and re-encoding that
 * string no longer addresses the entry on disk (`ENOENT`). Such entries can
 * only be skipped — unless the share's filename charset is fixed upstream.
 */
export function decodeEntryName(raw: Buffer): string | undefined {
  const decoded = raw.toString("utf8");
  return Buffer.from(decoded, "utf8").equals(raw) ? decoded : undefined;
}

export function getAudioExtensions(): Set<string> {
  const raw = process.env.MUSIC_EXTENSIONS ?? DEFAULT_EXTENSIONS;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function walk(root: string, exts: ReadonlySet<string>): WalkResult {
  const files: SourceFile[] = [];
  const skipped: WalkSkip[] = [];
  let dirCount = 0;

  /** Remember a path whose rows must never be deleted; dedupe repeats. */
  function skip(
    dir: string,
    reason: WalkSkip["reason"],
    code?: string,
    sample?: string,
  ): void {
    if (skipped.some((s) => s.path === dir && s.reason === reason)) return;
    skipped.push({
      path: dir,
      reason,
      ...(code === undefined ? {} : { code }),
      ...(sample === undefined ? {} : { sample }),
    });
  }

  function visit(dir: string, isRoot: boolean): void {
    let entries: fs.Dirent<Buffer>[];
    try {
      entries = fs.readdirSync(dir, {
        withFileTypes: true,
        encoding: "buffer",
      });
    } catch (err) {
      if (isRoot) {
        // Root unreadable (e.g. SMB not mounted, missing symlink target) →
        // throw so the caller can skip the source and keep previous stats.
        const code = (err as NodeJS.ErrnoException).code;
        throw new Error(
          `Cannot read directory: ${dir}${code === undefined ? "" : ` (${code})`}`,
          { cause: err },
        );
      }
      // An unreadable subdirectory no longer aborts the source: skip it, let
      // the scanner protect its rows, and keep walking its siblings.
      skip(dir, "unreadable", (err as NodeJS.ErrnoException).code);
      return;
    }
    for (const entry of entries) {
      const name = decodeEntryName(entry.name);
      if (name === undefined) {
        // Non-UTF-8 name: the entry cannot be addressed as a JS string. Protect
        // the parent — the DB form of any legacy row is unknowable — and skip.
        skip(dir, "encoding", undefined, entry.name.toString("latin1"));
        continue;
      }
      const full = path.join(dir, name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        dirCount++;
        visit(full, false);
      } else if (entry.isFile()) {
        const ext = path.extname(name).slice(1).toLowerCase();
        if (!exts.has(ext)) continue;
        try {
          const stat = fs.statSync(full);
          files.push({
            file: path.relative(root, full),
            mtimeMs: stat.mtimeMs,
            size: stat.size,
          });
        } catch {
          // file vanished mid-walk
        }
      }
    }
  }

  visit(root, true);
  files.sort((a, b) => a.file.localeCompare(b.file));
  return { files, dirCount, skipped };
}

export function walkSourceFiles(
  root: string,
  exts: ReadonlySet<string>,
): SourceFile[] {
  return walk(root, exts).files;
}

export function walkSource(
  root: string,
  exts: ReadonlySet<string>,
): SourceStats {
  const { files, dirCount } = walk(root, exts);
  let total_size = 0;
  for (const f of files) total_size += f.size;
  return { file_count: files.length, dir_count: dirCount, total_size };
}

export function computeSourceStats(root: string): SourceStats {
  const exts = getAudioExtensions();
  return walkSource(root, exts);
}

/**
 * Async twin of `computeSourceStats`: identical counting rules (skip symlinks,
 * count directories, filter audio extensions, sum sizes, ignore files that
 * vanish mid-walk) but does not block the event loop — used for on-demand stats
 * of large folders where a sync walk would freeze MPD polling and HTTP
 * handling. Only an unreadable root throws; unreadable subdirectories and
 * entries with non-UTF-8 names are skipped so stats reflect the readable subset.
 */
export async function computeSourceStatsAsync(
  root: string,
): Promise<SourceStats> {
  const exts = getAudioExtensions();
  let fileCount = 0;
  let dirCount = 0;
  let totalSize = 0;

  async function visit(dir: string, isRoot: boolean): Promise<void> {
    let entries: fs.Dirent<Buffer>[];
    try {
      entries = await fs.promises.readdir(dir, {
        withFileTypes: true,
        encoding: "buffer",
      });
    } catch (err) {
      if (isRoot) {
        const code = (err as NodeJS.ErrnoException).code;
        throw new Error(
          `Cannot read directory: ${dir}${code === undefined ? "" : ` (${code})`}`,
          { cause: err },
        );
      }
      return;
    }
    for (const entry of entries) {
      const name = decodeEntryName(entry.name);
      if (name === undefined) continue;
      const full = path.join(dir, name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        dirCount++;
        await visit(full, false);
      } else if (entry.isFile()) {
        const ext = path.extname(name).slice(1).toLowerCase();
        if (!exts.has(ext)) continue;
        fileCount++;
        try {
          const stat = await fs.promises.stat(full);
          totalSize += stat.size;
        } catch {
          // file vanished mid-walk
        }
      }
    }
  }

  await visit(root, true);
  return { file_count: fileCount, dir_count: dirCount, total_size: totalSize };
}
