import { albumsDb } from "@repo/db";
import type { CatalogSyncService } from "@services/library/catalogSyncService";
import type { ScanProgress } from "@services/library/libraryScanner";
import { broadcast } from "../../ws/broadcast";
import type { CoverSyncService } from "@services/library/coverSyncService";

export interface CatalogSyncOrchestrator {
  getCurrentSyncProgress(): Record<string, unknown> | null;
  setCurrentSyncProgress(progress: Record<string, unknown> | null): void;
  scanLibrary(): Promise<void>;
  scanImagesOnly(): Promise<void>;
}

export class CatalogSyncOrchestratorImpl implements CatalogSyncOrchestrator {
  constructor(
    private readonly coverSyncService: CoverSyncService,
    private readonly catalogSyncService: CatalogSyncService,
  ) {}

  private currentSyncProgress: Record<string, unknown> | null = null;
  private syncRunning = false;

  public getCurrentSyncProgress(): Record<string, unknown> | null {
    return this.currentSyncProgress;
  }

  public setCurrentSyncProgress(
    progress: Record<string, unknown> | null,
  ): void {
    this.currentSyncProgress = progress;
  }

  public async scanLibrary(): Promise<void> {
    if (this.syncRunning) {
      console.warn(
        "[Library] Sync already in progress — ignoring duplicate scan request",
      );
      return;
    }
    this.syncRunning = true;

    this.currentSyncProgress = {
      phase: "scan-started",
      current: 0,
      total: 0,
      track: null,
    };
    broadcast({ type: "sync-progress", ...this.currentSyncProgress });

    try {
      // Phase 1: Scan storage sources and sync tracks into the catalog
      await this.catalogSyncService.scanAll((progress: ScanProgress) => {
        this.currentSyncProgress = { ...progress };
        broadcast({ type: "sync-progress", ...progress });
      });

      // Phase 2: Extract covers for all albums
      const albums = albumsDb.getAll();
      if (albums.length > 0) {
        await this.coverSyncService.syncAllCovers(albums, (progress) => {
          this.currentSyncProgress = {
            phase: "covers",
            current: progress.current,
            total: progress.total,
            track: {
              title: progress.album.title,
              artist: progress.album.artist,
              album: progress.album.title,
            },
          };
          broadcast({
            type: "sync-progress",
            ...this.currentSyncProgress,
          });
        });
      }

      this.currentSyncProgress = null;
      broadcast({ type: "sync-complete", current: 1, total: 1 });
    } catch (err) {
      this.currentSyncProgress = null;
      broadcast({
        type: "sync-error",
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      this.syncRunning = false;
    }
  }

  public async scanImagesOnly(): Promise<void> {
    if (this.syncRunning) {
      console.warn(
        "[Library] Sync already in progress — ignoring duplicate scan request",
      );
      return;
    }
    this.syncRunning = true;
    const albums = albumsDb.getAll();
    if (albums.length === 0) {
      this.currentSyncProgress = null;
      broadcast({ type: "sync-complete", current: 1, total: 1 });
      this.syncRunning = false;
      return;
    }
    try {
      await this.coverSyncService.syncAllCovers(
        albums,
        (progress: {
          current: number;
          total: number;
          album: { title: string; artist: string };
        }) => {
          this.currentSyncProgress = {
            phase: "covers",
            current: progress.current,
            total: progress.total,
            track: {
              title: progress.album.title,
              artist: progress.album.artist,
              album: progress.album.title,
            },
          };
          broadcast({
            type: "sync-progress",
            ...this.currentSyncProgress,
          });
        },
      );
      this.currentSyncProgress = null;
      broadcast({ type: "sync-complete", current: 1, total: 1 });
    } catch (err) {
      this.currentSyncProgress = null;
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
