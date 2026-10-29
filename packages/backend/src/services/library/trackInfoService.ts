import path from "path";
import { albumsDb, artistsDb, storageDb, tracksDb } from "@repo/db";
import type { TrackInfo } from "@repo/types/catalog";

function getMusicDir(): string {
  return path.resolve(process.env.MUSIC_DIR ?? "/opt/sonect/music");
}

function resolveInsideMusicDir(file: string): string | null {
  const musicDir = getMusicDir();
  const resolved = path.resolve(musicDir, file);
  const relative = path.relative(musicDir, resolved);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  return resolved;
}

export interface TrackInfoService {
  getTrackInfo(trackId: number): TrackInfo | null;
}

export class TrackInfoServiceImpl implements TrackInfoService {
  getTrackInfo(trackId: number): TrackInfo | null {
    const track = tracksDb.getByIdWithRelations(trackId);
    if (!track) return null;

    const album = track.album_id ? albumsDb.getById(track.album_id) : undefined;
    const albumArtist = album?.artist_id
      ? (artistsDb.getById(album.artist_id)?.name ?? null)
      : null;
    const source = track.storage_source_id
      ? storageDb.getById(track.storage_source_id)
      : undefined;

    return {
      id: track.id,
      title: track.title,
      file: track.file,
      absolutePath: resolveInsideMusicDir(track.file),
      artist: track.artist_name ?? null,
      album: track.album_title ?? null,
      albumArtist,
      genre: track.genre ?? null,
      year: album?.year ?? null,
      date: track.date ?? null,
      trackNumber: track.track_number ?? null,
      discNumber: track.disc_number ?? null,
      duration: track.duration ?? null,
      size: track.size ?? null,
      mtime: track.mtime ?? null,
      storageSource: source
        ? { id: source.id, name: source.name, path: source.path }
        : null,
      playCount: track.play_count ?? 0,
      lastPlayed: track.last_played ?? null,
      createdAt: track.created_at ?? null,
      updatedAt: track.updated_at ?? null,
    };
  }
}
