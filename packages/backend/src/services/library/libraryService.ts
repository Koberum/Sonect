import { tracksDb, artistsDb, albumsDb, statsDb } from "@repo/db";
import { LibraryStats, SearchResults } from "@repo/types/library";
import type {
  SyncProgress,
  LibrarySyncService,
} from "@services/library/librarySyncService";
import { scanStorageStats } from "@services/storage/storageStats";
import { broadcast } from "../../ws/broadcast";
import type { CoverService } from "@services/library/coverService";
import type { PlayerService } from "@services/player/playerService";

export interface LibraryService {
  getLibraryStats(): LibraryStats;
  searchTracks(query: string): SearchResults;
  getCurrentSyncProgress(): Record<string, unknown> | null;
  setCurrentSyncProgress(progress: Record<string, unknown> | null): void;
  scanLibrary(): Promise<void>;
  scanImagesOnly(): Promise<void>;
}

export class LibraryServiceImpl implements LibraryService {
  constructor(
    private readonly playerService: PlayerService,
    private readonly coverService: CoverService,
    private readonly librarySyncService: LibrarySyncService,
  ) {}

  private currentSyncProgress: Record<string, unknown> | null = null;
  private syncRunning = false;

  public getLibraryStats(): LibraryStats {
    return statsDb.getStats();
  }

  public searchTracks(query: string): SearchResults {
    const q = query.toLowerCase();

    const matchedArtists = artistsDb.search(q);
    const artists = matchedArtists.map((artist) => ({
      ...artist,
      coverPreviews: albumsDb.getCoverPreviews(artist.id, 4),
    }));
    const albums = albumsDb.search(q);
    const tracks = tracksDb.search(query);

    return { artists, albums, tracks };
  }

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
      await this.playerService.updateLibrary();

      // Phase 1: Sync tracks from MPD
      await this.librarySyncService.syncAll((progress: SyncProgress) => {
        this.currentSyncProgress = { ...progress } as Record<string, unknown>;
        broadcast({ type: "sync-progress", ...progress });
      });

      // Phase 2: Extract covers for all albums
      const albums = albumsDb.getAll();
      if (albums.length > 0) {
        await this.coverService.syncAllCovers(albums, (progress) => {
          this.currentSyncProgress = {
            phase: "covers",
            current: progress.current,
            total: progress.total,
          };
          broadcast({
            type: "sync-progress",
            ...this.currentSyncProgress,
          });
        });
      }

      // Phase 3: Refresh per-source library statistics
      try {
        scanStorageStats();
      } catch (err) {
        console.error("[Library] Failed to scan storage stats:", err);
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
      await this.coverService.syncAllCovers(
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
