import { tracksDb, artistsDb, albumsDb, statsDb, genresDb } from "@repo/db";
import { Track, Artist, Album, LibraryStats, SearchResults } from "@repo/types";

import { DBAlbum, DBArtist, DBTrack } from "@repo/types";
import { MpdSyncService, type SyncProgress } from "./mpdSyncService";
import { CoverService } from "./coverService";
import { scanStorageStats } from "./storageStats";
import { broadcast } from "../ws/broadcast";
import * as playerService from "./playerService";

export async function resolveTrack(
  artist: string,
  album: string,
  title: string,
): Promise<Track | null> {
  const dbTrack = await tracksDb.getByArtistAlbumTitle(artist, album, title);
  if (!dbTrack) return null;

  const dbArtist = dbTrack.artist_id
    ? await artistsDb.getById(dbTrack.artist_id)
    : undefined;
  const dbAlbum = dbTrack.album_id
    ? await albumsDb.getById(dbTrack.album_id)
    : undefined;

  return mapDbTrackToTrack(dbTrack, dbArtist, dbAlbum);
}

export async function getLibraryStats(): Promise<LibraryStats> {
  return statsDb.getStats();
}

export async function getAllArtists(
  limit?: number,
  offset?: number,
): Promise<Artist[]> {
  const artists = artistsDb.getAll({ limit, offset });
  return artists.map((artist) => ({
    ...artist,
    coverPreviews: albumsDb.getCoverPreviews(artist.id, 4),
  }));
}

export async function getArtistCount(): Promise<number> {
  return artistsDb.count();
}

export async function getArtistById(id: number): Promise<Artist | undefined> {
  return artistsDb.getById(id);
}

export async function getAlbumsByArtist(artistId: number): Promise<Album[]> {
  return albumsDb.getByArtist(artistId);
}

export async function getAllAlbums(
  sort?: string,
  limit?: number,
  offset?: number,
): Promise<Album[]> {
  return albumsDb.getAll({ sort, limit, offset });
}

export async function getAlbumCount(): Promise<number> {
  return albumsDb.count();
}

export async function getRecentlyAddedAlbums(limit = 20): Promise<Album[]> {
  return albumsDb.getRecent(limit);
}

export async function getAlbumById(id: number): Promise<Album | undefined> {
  return albumsDb.getById(id);
}

export async function updateAlbumCoverPath(
  albumId: number,
  coverPath: string,
): Promise<void> {
  albumsDb.updateCoverPath(albumId, coverPath);
}

export async function getTracksByAlbum(albumId: number): Promise<Track[]> {
  const album = albumsDb.getById(albumId);
  if (!album) throw new Error("Album not found");

  return (await tracksDb.getByAlbum(albumId)).map((dbTrack) => {
    const trackArtist = dbTrack.artist_id
      ? artistsDb.getById(dbTrack.artist_id)
      : undefined;
    return mapDbTrackToTrack(dbTrack, trackArtist, album);
  });
}

export async function getTracksByArtist(artistId: number): Promise<Track[]> {
  const artist = artistsDb.getById(artistId);
  if (!artist) throw new Error("Artist not found");

  return (await tracksDb.getByArtist(artistId)).map((dbTrack) =>
    mapDbTrackToTrack(dbTrack, artist),
  );
}

export function mapDbTrackToTrack(
  dbTrack: DBTrack,
  artist?: DBArtist,
  album?: DBAlbum & { genre?: string },
): Track {
  return {
    ...dbTrack,
    artist_name: artist?.name ?? "",
    cover_path: album?.cover_path ?? "",
    album_name: album?.title,
    genre:
      (dbTrack as any).genre ??
      (dbTrack.genre_id
        ? genresDb.getById(dbTrack.genre_id)?.name
        : undefined) ??
      album?.genre ??
      undefined,
  };
}

export async function getAllTracks(
  sort?: string,
  limit?: number,
  offset?: number,
): Promise<Track[]> {
  const dbTracks = tracksDb.getAll({ sort, limit, offset });
  return dbTracks.map((dbTrack) => {
    const artist = dbTrack.artist_id
      ? artistsDb.getById(dbTrack.artist_id)
      : undefined;
    const album = dbTrack.album_id
      ? albumsDb.getById(dbTrack.album_id)
      : undefined;
    return mapDbTrackToTrack(dbTrack, artist, album);
  });
}

export async function getTrackCount(): Promise<number> {
  return tracksDb.count();
}

export async function getRecentlyAddedTracks(limit = 20): Promise<Track[]> {
  const dbTracks = tracksDb.getRecent(limit);
  return dbTracks.map((dbTrack) => {
    const artist = dbTrack.artist_id
      ? artistsDb.getById(dbTrack.artist_id)
      : undefined;
    const album = dbTrack.album_id
      ? albumsDb.getById(dbTrack.album_id)
      : undefined;
    return mapDbTrackToTrack(dbTrack, artist, album);
  });
}

export async function getGenres(): Promise<
  { genre: string; track_count: number; album_count: number }[]
> {
  return tracksDb.getGenres();
}

export async function getAlbumsByGenre(genre: string): Promise<Album[]> {
  return albumsDb.getByGenre(genre);
}

export async function getTracksByGenre(genre: string): Promise<Track[]> {
  const dbTracks = tracksDb.getByGenre(genre);
  return dbTracks.map((dbTrack) => {
    const artist = dbTrack.artist_id
      ? artistsDb.getById(dbTrack.artist_id)
      : undefined;
    const album = dbTrack.album_id
      ? albumsDb.getById(dbTrack.album_id)
      : undefined;
    return mapDbTrackToTrack(dbTrack, artist, album);
  });
}

export async function search(query: string): Promise<SearchResults> {
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
    return mapDbTrackToTrack(dbTrack, artist, album);
  });

  return { artists, albums, tracks };
}

let currentSyncProgress: Record<string, unknown> | null = null;
let syncRunning = false;

export function getCurrentSyncProgress(): Record<string, unknown> | null {
  return currentSyncProgress;
}

export function setCurrentSyncProgress(
  progress: Record<string, unknown> | null,
): void {
  currentSyncProgress = progress;
}

export async function scanLibrary(): Promise<void> {
  if (syncRunning) {
    console.warn(
      "[Library] Sync already in progress — ignoring duplicate scan request",
    );
    return;
  }
  syncRunning = true;

  currentSyncProgress = {
    phase: "scan-started",
    current: 0,
    total: 0,
    track: null,
  };
  broadcast({ type: "sync-progress", ...currentSyncProgress });

  try {
    await playerService.updateLibrary();

    const syncService = new MpdSyncService();
    const coverService = new CoverService();

    // Phase 1: Sync tracks from MPD
    await syncService.syncAll((progress: SyncProgress) => {
      currentSyncProgress = { ...progress } as Record<string, unknown>;
      broadcast({ type: "sync-progress", ...progress });
    });

    // Phase 2: Extract covers for all albums
    const albums = albumsDb.getAll();
    if (albums.length > 0) {
      await coverService.syncAllCovers(albums, (progress) => {
        currentSyncProgress = {
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
          ...currentSyncProgress,
        });
      });
    }

    // Phase 3: Refresh per-source library statistics
    try {
      scanStorageStats();
    } catch (err) {
      console.error("[Library] Failed to scan storage stats:", err);
    }

    currentSyncProgress = null;
    broadcast({ type: "sync-complete", current: 1, total: 1 });
  } catch (err) {
    currentSyncProgress = null;
    broadcast({
      type: "sync-error",
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    syncRunning = false;
  }
}

export async function scanImagesOnly(): Promise<void> {
  if (syncRunning) {
    console.warn(
      "[Library] Sync already in progress — ignoring duplicate scan request",
    );
    return;
  }
  syncRunning = true;

  const coverService = new CoverService();
  const albums = albumsDb.getAll();
  if (albums.length === 0) {
    currentSyncProgress = null;
    broadcast({ type: "sync-complete", current: 1, total: 1 });
    syncRunning = false;
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
        currentSyncProgress = {
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
          ...currentSyncProgress,
        });
      },
    );
    currentSyncProgress = null;
    broadcast({ type: "sync-complete", current: 1, total: 1 });
  } catch (err) {
    currentSyncProgress = null;
    broadcast({
      type: "sync-error",
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    syncRunning = false;
  }
}
