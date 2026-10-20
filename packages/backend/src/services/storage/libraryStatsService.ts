import { storageDb, tracksDb } from "@repo/db";
import type { StorageSource } from "@repo/types";
import type { LogService } from "@services/utils/logService";
import { computeSourceStatsAsync } from "./storageStats";

export interface LibraryStatsService {
  refresh(ids: Iterable<number>): Promise<void>;
  refreshOne(id: number): Promise<StorageSource | undefined>;
}

/**
 * Persist per-library stats. `file_count` is the catalog count (what MPD
 * actually indexed and Sonect can show); `dir_count`/`total_size` still need a
 * filesystem walk because MPD exposes neither per directory.
 */
export class LibraryStatsServiceImpl implements LibraryStatsService {
  constructor(private readonly logService: LogService) {}

  async refresh(ids: Iterable<number>): Promise<void> {
    for (const id of new Set(ids)) {
      const source = storageDb.getById(id);
      if (!source) continue;

      const fileCount = tracksDb.countByStorageSource(id);
      try {
        const walked = await computeSourceStatsAsync(source.path);
        storageDb.updateStats(id, {
          file_count: fileCount,
          dir_count: walked.dir_count,
          total_size: walked.total_size,
        });
      } catch (err) {
        this.logService.pushLog(
          "warn",
          `Failed to refresh stats for library "${source.name}"; keeping previous directory and size values`,
          { error: err instanceof Error ? err.message : err },
        );
        storageDb.updateStats(id, {
          file_count: fileCount,
          dir_count: source.dir_count ?? 0,
          total_size: source.total_size ?? 0,
        });
      }
    }
  }

  async refreshOne(id: number): Promise<StorageSource | undefined> {
    const source = storageDb.getById(id);
    if (!source) return undefined;

    const fileCount = tracksDb.countByStorageSource(id);
    const walked = await computeSourceStatsAsync(source.path);
    storageDb.updateStats(id, {
      file_count: fileCount,
      dir_count: walked.dir_count,
      total_size: walked.total_size,
    });
    return storageDb.getById(id);
  }
}
