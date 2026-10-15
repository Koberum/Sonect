import {
  initDatabase,
  tracksDb,
  syncMetadataDb,
  catalogSyncDb,
} from "@repo/db";
import type { LogService } from "@services/utils/logService";
import {
  LibraryScanner,
  type ScanProgress,
  type ScanResult,
} from "@services/library/libraryScanner";

export type { ScanResult, ScanProgress };

export class CatalogSyncService {
  constructor(
    private readonly scanner: LibraryScanner,
    private readonly logService: LogService,
  ) {}

  async initDatabase(): Promise<void> {
    await initDatabase();
  }

  async scanAll(
    onProgress?: (progress: ScanProgress) => void,
  ): Promise<ScanResult> {
    this.logService.pushLog("info", "Starting library scan");
    const result = await this.scanner.scan(onProgress);
    this.logService.pushLog(
      "info",
      `Library scan finished: ${result.synced} synced, ${result.deleted} deleted, ${result.errors} errors`,
    );
    return result;
  }

  getStats(): {
    totalTracks: number;
    lastSync?: Date;
  } {
    return {
      totalTracks: tracksDb.count(),
      lastSync: syncMetadataDb.getLastSync(),
    };
  }

  clearAll(): void {
    this.logService.pushLog("warn", "Clearing all database data");
    catalogSyncDb.clearAll();
    this.logService.pushLog("info", "Database cleared");
  }
}
