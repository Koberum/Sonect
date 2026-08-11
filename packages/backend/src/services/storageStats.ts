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

function getAudioExtensions(): Set<string> {
  const raw = process.env.MUSIC_EXTENSIONS ?? DEFAULT_EXTENSIONS;
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function walkSource(
  root: string,
  exts: ReadonlySet<string>,
): SourceStats {
  const stats: SourceStats = { file_count: 0, dir_count: 0, total_size: 0 };

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
        stats.dir_count++;
        visit(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        if (exts.has(ext)) {
          stats.file_count++;
          try {
            stats.total_size += fs.statSync(full).size;
          } catch {
            // file vanished mid-walk
          }
        }
      }
    }
  }

  visit(root);
  return stats;
}

export function scanStorageStats(): void {
  const exts = getAudioExtensions();
  for (const source of storageDb.getAll()) {
    try {
      const stats = walkSource(source.mount_path, exts);
      storageDb.updateStats(source.id, stats);
    } catch (err: any) {
      console.error(
        `[Storage] Failed to scan stats for ${source.name}:`,
        err?.message ?? err,
      );
    }
  }
}
