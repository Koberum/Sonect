import { tracksDb, artistsDb, albumsDb, statsDb } from "@repo/db";
import { LibraryStats, SearchResults } from "@repo/types";
import { MpdSyncService, type SyncProgress } from "./mpdSyncService";
import { scanStorageStats } from "./storageStats";
import { broadcast } from "../ws/broadcast";
import * as playerService from "./playerService";

interface LibraryService {
  getLibraryStats(): Promise<LibraryStats>;
  search(query: string): Promise<SearchResults>;
  getCurrentSyncProgress(): Record<string, unknown> | null;
  setCurrentSyncProgress(progress: Record<string, unknown> | null): void;
  scanLibrary(): Promise<void>;
  scanImagesOnly(): Promise<void>;
}

class LibraryServiceImpl implements LibraryService {
  private currentSyncProgress: Record<string, unknown> | null = null;
  private syncRunning = false;

  public async getLibraryStats(): Promise<LibraryStats> {
    return statsDb.getStats();
  }

  public async search(query: string): Promise<SearchResults> {
    const q = query.toLowerCase();

    const matchedArtists = artistsDb.search(q);
    const artists = matchedArtists.map((artist) => ({
      ...artist,
      coverPreviews: albumsDb.getCoverPreviews(artist.id, 4),
    }));

    const albums = albumsDb.search(q);

    const matchedTracks = tracksDb.search(query);
    const tracks = matchedTracks.map((dbTrack) => {
      const artist = dbTrack.artist_id
        ? artistsDb.getById(dbTrack.artist_id)
        : undefined;
      const album = dbTrack.album_id
        ? albumsDb.getById(dbTrack.album_id)
        : undefined;
      return this.mapDbTrackToTrack(dbTrack, artist, album);
    });

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
      await playerService.updateLibrary();

      const syncService = new MpdSyncService();
      const coverService = new CoverService();

      // Phase 1: Sync tracks from MPD
      await syncService.syncAll((progress: SyncProgress) => {
        this.currentSyncProgress = { ...progress } as Record<string, unknown>;
        broadcast({ type: "sync-progress", ...progress });
      });

      // Phase 2: Extract covers for all albums
      const albums = albumsDb.getAll();
      if (albums.length > 0) {
        await coverService.syncAllCovers(albums, (progress: SyncProgress) => {
          this.currentSyncProgress = {
            phase: "covers",
            current: progress.current,
            total: progress.total,
            track: {
              title: progress.track?.title,
              artist: progress.track?.artist,
              album: progress.track?.album,
            },
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

    const coverService = new CoverService();
    const albums = albumsDb.getAll();
    if (albums.length === 0) {
      this.currentSyncProgress = null;
      broadcast({ type: "sync-complete", current: 1, total: 1 });
      this.syncRunning = false;
      return;
    }
    try {
      await coverService.syncAllCovers(
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

export const libraryService = new LibraryServiceImpl();
