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

  async scanAll(
    onProgress?: (progress: ScanProgress) => void,
  ): Promise<ScanResult> {
    this.logService.pushLog("info", "Starting library scan");
    return this.scanner.scan(onProgress);
  }
}
