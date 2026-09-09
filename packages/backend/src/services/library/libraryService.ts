import { tracksDb, artistsDb, albumsDb, statsDb } from "@repo/db";
import { LibraryStats, SearchResults } from, TrackWithCover "@repo/types/library";
import {
  MpdSyncService,
  type SyncProgress,
} from "@services/mpd/mpdSyncService";
import { scanStorageStats } from "@services/storage/storageStats";
import { broadcast } from "../../ws/broadcast";
import { PlayerService } from "@services/player/playerService";
import { LogService } from "@services/utils/logService";
import { CoverService } from "@services/library/coverService";
import { GenreService } from "@services/library/genreService";
import { DBAlbum, DBArtist, DBTrack } from "@repo/types";
import { TrackWithCover } from "@repo/types/library";

interface LibraryService {
  getLibraryStats(): Promise<LibraryStats>;
  search(query: string): Promise<SearchResults>;
  getCurrentSyncProgress(): Record<string, unknown> | null;
  setCurrentSyncProgress(progress: Record<string, unknown> | null): void;
  scanLibrary(): Promise<void>;
  scanImagesOnly(): Promise<void>;
  searchTracks(query: string): Promise<SearchResults>;
}

class LibraryServiceImpl implements LibraryService {
  constructor(
    private readonly playerService: PlayerService,
    private readonly coverService: CoverService,
    private readonly genreService: GenreService,
    private readonly logService: LogService,
  ) {}

  private currentSyncProgress: Record<string, unknown> | null = null;
  private syncRunning = false;

  public async getLibraryStats(): Promise<LibraryStats> {
    return statsDb.getStats();
  }

  public async searchTracks(query: string): Promise<SearchResults> {
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

  public async mapDbTrackToTrack(
    dbTrack: DBTrack,
    artist?: DBArtist | null,
    album?: (DBAlbum & { genre?: string }) | null,
  ): Promise<TrackWithCover> {
    return {
      ...dbTrack,
      artist_name: artist?.name ?? "",
      cover_path: album?.cover_path ?? "",
      album_name: album?.title,
      genre:
        (dbTrack as any).genre ??
        (dbTrack.genre_id
          ? (await this.genreService.getById(dbTrack.genre_id))?.name
          : undefined) ??
        album?.genre ??
        undefined,
    };
  }
}
