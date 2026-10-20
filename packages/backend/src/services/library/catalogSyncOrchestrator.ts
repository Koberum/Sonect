import { albumsDb } from "@repo/db";
import type { LibrarySyncProgress } from "@repo/types/catalog";
import type { CatalogSyncService } from "@services/library/mpdCatalogSyncService";
import { broadcast } from "../../ws/broadcast";
import type { CoverSyncService } from "@services/library/coverSyncService";
import type { LibraryStatsService } from "@services/storage/libraryStatsService";

export interface CatalogSyncOrchestrator {
  getCurrentSyncProgress(): LibrarySyncProgress | null;
  scanLibrary(options?: { force?: boolean }): Promise<void>;
}

export class CatalogSyncOrchestratorImpl implements CatalogSyncOrchestrator {
  constructor(
    private readonly coverSyncService: CoverSyncService,
    private readonly catalogSyncService: CatalogSyncService,
    private readonly libraryStatsService: LibraryStatsService,
  ) {}

  private currentSyncProgress: LibrarySyncProgress | null = null;
  private syncRunning = false;

  public getCurrentSyncProgress(): LibrarySyncProgress | null {
    return this.currentSyncProgress;
  }

  private setProgress(progress: LibrarySyncProgress | null): void {
    this.currentSyncProgress = progress;
    if (progress) {
      broadcast({ type: "sync-progress", ...progress });
    }
  }

  public async scanLibrary(options: { force?: boolean } = {}): Promise<void> {
    if (this.syncRunning) {
      console.warn(
        "[Library] Sync already in progress — ignoring duplicate scan request",
      );
      return;
    }
    this.syncRunning = true;

    this.setProgress({
      phase: "scan-started",
      current: 0,
      total: 0,
      track: null,
    });

    try {
      const result = await this.catalogSyncService.sync(
        { force: options.force },
        (progress) => this.setProgress(progress),
      );

      const albums = albumsDb.getAll();
      const covers =
        albums.length > 0
          ? this.coverSyncService.syncAllCovers(albums, (progress) => {
              this.setProgress({
                phase: "covers",
                current: progress.current,
                total: progress.total,
                track: {
                  title: progress.album.title,
                  artist: progress.album.artist,
                  album: progress.album.title,
                },
              });
            })
          : Promise.resolve();

      await Promise.all([
        covers,
        this.libraryStatsService.refresh(result.changedSourceIds),
      ]);

      this.setProgress(null);
      broadcast({ type: "sync-complete", current: 1, total: 1 });
    } catch (err) {
      this.setProgress(null);
      broadcast({
        type: "sync-error",
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      this.syncRunning = false;
    }
  }
}
