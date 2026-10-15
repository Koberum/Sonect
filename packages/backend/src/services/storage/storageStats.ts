import fs from "fs";
import path from "path";
import { storageDb } from "@repo/db";

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

function getAudioExtensions(): Set<string> {
  const raw = process.env.MUSIC_EXTENSIONS ?? DEFAULT_EXTENSIONS;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

function walk(
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
      // throw so scanStorageStats skips the source and keeps previous stats.
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

export function scanStorageStats(): void {
  for (const source of storageDb.getAll()) {
    try {
      const stats = computeSourceStats(source.path);
      storageDb.updateStats(source.id, stats);
    } catch (err) {
      console.error(
        `[Storage] Failed to scan stats for ${source.name}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
