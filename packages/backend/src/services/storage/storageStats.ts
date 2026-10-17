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

export function getAudioExtensions(): Set<string> {
  const raw = process.env.MUSIC_EXTENSIONS ?? DEFAULT_EXTENSIONS;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function walk(
  root: string,
  exts: ReadonlySet<string>,
): { files: SourceFile[]; dirCount: number } {
  const files: SourceFile[] = [];
  let dirCount = 0;

  function visit(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      // Root unreadable (e.g. SMB not mounted, missing symlink target) →
      // throw so the caller can skip the source and keep previous stats.
      // An unreadable subdirectory also aborts the walk for this source.
      throw new Error(`Cannot read directory: ${dir}`);
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        dirCount++;
        visit(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
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

  visit(root);
  files.sort((a, b) => a.file.localeCompare(b.file));
  return { files, dirCount };
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
 * vanish mid-walk, throw on unreadable directories) but does not block the
 * event loop — used for on-demand stats of large folders where a sync walk
 * would freeze MPD polling and HTTP handling.
 */
export async function computeSourceStatsAsync(
  root: string,
): Promise<SourceStats> {
  const exts = getAudioExtensions();
  let fileCount = 0;
  let dirCount = 0;
  let totalSize = 0;

  async function visit(dir: string): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      throw new Error(`Cannot read directory: ${dir}`);
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        dirCount++;
        await visit(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
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

  await visit(root);
  return { file_count: fileCount, dir_count: dirCount, total_size: totalSize };
}
