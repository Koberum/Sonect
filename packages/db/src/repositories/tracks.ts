import {
  and,
  asc,
  count,
  desc,
  eq,
  getColumns,
  like,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { CatalogTrack, DBTrack, DBTrackWithRelations } from "@repo/types";
import { db } from "../connection.js";
import { albums, artists, genres, storageSources, tracks } from "../tables.js";
import { normalizeRowId, type QueryExecutor } from "./rowId.js";
import { findOrCreateArtist } from "./artists.js";
import { findOrCreateAlbum } from "./albums.js";
import { findOrCreateGenre } from "./genres.js";

// The same physical song can exist under several library paths (e.g. mirrored
// folders), which produces distinct rows (tracks.file is unique). Album views
// collapse those copies at read time without touching the MPD mirror. The key
// ignores the file path (and the track artist, which may be tagged differently
// from the album artist), so only one row per logical position in an album is
// returned. When copies differ in format, the lossless one is kept.
type AlbumTrackKey = {
  album_id?: number | null;
  disc_number?: number | null;
  track_number?: number | null;
  title: string;
  file: string;
};

const LOSSLESS_EXTENSIONS = new Set([
  "flac",
  "wav",
  "aiff",
  "aif",
  "ape",
  "alac",
  "dsf",
  "dff",
  "wv",
  "tta",
]);

function isLosslessFile(file: string): boolean {
  const extension = file.split(".").pop()?.toLowerCase() ?? "";
  return LOSSLESS_EXTENSIONS.has(extension);
}

function dedupeAlbumTracks<T extends AlbumTrackKey>(rows: T[]): T[] {
  const canonical = new Map<string, T>();
  for (const row of rows) {
    const key = [
      row.album_id ?? "",
      row.disc_number ?? "",
      row.track_number ?? "",
      row.title.trim().toLowerCase(),
    ].join("\u0000");
    const current = canonical.get(key);
    if (
      !current ||
      (isLosslessFile(row.file) && !isLosslessFile(current.file))
    ) {
      canonical.set(key, row);
    }
  }
  const kept = new Set(canonical.values());
  return rows.filter((row) => kept.has(row));
}

export const dBTrackWithRelations = {
  ...getColumns(tracks),
  artist_name: artists.name,
  album_title: albums.title,
  cover_path: albums.cover_path,
  genre: genres.name,
};

const joinedOnArtistAndAlbum = () =>
  db()
    .select(dBTrackWithRelations)
    .from(tracks)
    .innerJoin(artists, eq(tracks.artist_id, artists.id))
    .innerJoin(albums, eq(tracks.album_id, albums.id))
    .leftJoin(genres, eq(tracks.genre_id, genres.id));

// Parse helpers kept byte-compatible with the previous storage layer: MPD can
// report "3/10" track positions and "2024-05-01" dates, and unparseable values
// were always passed through as parseInt produced them.
function trackNumberOf(track: CatalogTrack): number | null {
  return track.track ? parseInt(track.track.toString().split("/")[0]) : null;
}

function discNumberOf(track: CatalogTrack): number | null {
  return track.disc ? parseInt(track.disc.toString()) : null;
}

function yearOf(track: CatalogTrack): number | undefined {
  return track.date ? parseInt(track.date.split("-")[0]) : undefined;
}

export type SyncTrackSnapshot = {
  file: string;
  title: string;
  artist_name: string | null;
  album_artist_name: string | null;
  album_id: number | null;
  album_title: string | null;
  genre: string | null;
  track_number: number | null;
  disc_number: number | null;
  duration: number | null;
  sample_rate: number | null;
  bits_per_sample: number | null;
  channels: number | null;
  date: string | null;
  storage_source_id: number | null;
};

// Single definition used by tracksDb and by the transactional catalog apply:
// playback statistics are never touched here, only metadata.
export function upsertTrack(
  executor: QueryExecutor,
  track: CatalogTrack,
): number {
  const genreId =
    track.genre && track.genre.trim() !== ""
      ? findOrCreateGenre(executor, track.genre)
      : undefined;
  const artistId = track.artist
    ? findOrCreateArtist(executor, track.artist)
    : undefined;
  const albumArtistId = track.albumArtist
    ? findOrCreateArtist(executor, track.albumArtist)
    : undefined;
  const albumId = track.album
    ? findOrCreateAlbum(
        executor,
        track.album,
        albumArtistId ?? artistId,
        yearOf(track),
        genreId,
      )
    : undefined;

  const existing = executor
    .select({ id: tracks.id })
    .from(tracks)
    .where(eq(tracks.file, track.file))
    .get();

  if (existing) {
    executor
      .update(tracks)
      .set({
        title: track.title || "Unknown",
        artist_id: artistId ?? null,
        album_id: albumId ?? null,
        genre_id: genreId ?? null,
        track_number: trackNumberOf(track),
        disc_number: discNumberOf(track),
        duration: track.duration ?? null,
        sample_rate: track.sampleRate ?? null,
        bits_per_sample: track.bitsPerSample ?? null,
        channels: track.channels ?? null,
        date: track.date ?? null,
        storage_source_id: track.storageSourceId ?? null,
        mtime: track.mtime ?? null,
        size: track.size ?? null,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(tracks.id, existing.id))
      .run();
    return existing.id;
  }

  const result = executor
    .insert(tracks)
    .values({
      file: track.file,
      title: track.title || "Unknown",
      artist_id: artistId ?? null,
      album_id: albumId ?? null,
      genre_id: genreId ?? null,
      track_number: trackNumberOf(track),
      disc_number: discNumberOf(track),
      duration: track.duration ?? null,
      sample_rate: track.sampleRate ?? null,
      bits_per_sample: track.bitsPerSample ?? null,
      channels: track.channels ?? null,
      date: track.date ?? null,
      storage_source_id: track.storageSourceId ?? null,
      mtime: track.mtime ?? null,
      size: track.size ?? null,
    })
    .run();
  return normalizeRowId(result.lastInsertRowid);
}

export const tracksDb = {
  incrementPlayCount(trackId: number): void {
    db()
      .update(tracks)
      .set({
        play_count: sql`${tracks.play_count} + 1`,
        last_played: sql`datetime('now')`,
      })
      .where(eq(tracks.id, trackId))
      .run();
  },

  getTracksByGenre(genre: string, limit: number): DBTrackWithRelations[] {
    return joinedOnArtistAndAlbum()
      .where(sql`${genres.name} = ${genre} COLLATE NOCASE`)
      .orderBy(desc(tracks.play_count))
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },

  count(): number {
    const row = db().select({ value: count() }).from(tracks).get();
    return row?.value ?? 0;
  },

  getRandomWithRelations(limit: number): DBTrackWithRelations[] {
    return joinedOnArtistAndAlbum()
      .orderBy(sql`random()`)
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },

  getMostCommonGenre(): string | null {
    const row = db()
      .select({ genre: genres.name, total: sql<number>`count(*)` })
      .from(tracks)
      .innerJoin(genres, eq(tracks.genre_id, genres.id))
      .groupBy(genres.id, genres.name)
      .orderBy(desc(sql`count(*)`))
      .limit(1)
      .get();
    return row?.genre ?? null;
  },

  getByGenreWithRelations(genre: string): DBTrackWithRelations[] {
    return joinedOnArtistAndAlbum()
      .where(sql`${genres.name} = ${genre} COLLATE NOCASE`)
      .orderBy(asc(tracks.title))
      .all() as DBTrackWithRelations[];
  },

  getById(id: number): DBTrack | undefined {
    return db().select().from(tracks).where(eq(tracks.id, id)).get() as
      DBTrack | undefined;
  },

  getByAlbum(albumId: number): DBTrack[] {
    return db()
      .select()
      .from(tracks)
      .where(eq(tracks.album_id, albumId))
      .orderBy(
        asc(tracks.disc_number),
        asc(tracks.track_number),
        asc(tracks.title),
      )
      .all() as DBTrack[];
  },

  getByAlbumOrdered(albumId: number): DBTrack[] {
    return dedupeAlbumTracks(
      db()
        .select()
        .from(tracks)
        .where(eq(tracks.album_id, albumId))
        .orderBy(
          asc(tracks.disc_number),
          asc(tracks.track_number),
          asc(tracks.id),
        )
        .all() as DBTrack[],
    );
  },

  getByFile(file: string): DBTrack | undefined {
    return db().select().from(tracks).where(eq(tracks.file, file)).get() as
      DBTrack | undefined;
  },

  getSyncSnapshot(): SyncTrackSnapshot[] {
    const albumArtist = alias(artists, "album_artist");
    return db()
      .select({
        file: tracks.file,
        title: tracks.title,
        artist_name: artists.name,
        album_artist_name: albumArtist.name,
        album_id: tracks.album_id,
        album_title: albums.title,
        genre: genres.name,
        track_number: tracks.track_number,
        disc_number: tracks.disc_number,
        duration: tracks.duration,
        sample_rate: tracks.sample_rate,
        bits_per_sample: tracks.bits_per_sample,
        channels: tracks.channels,
        date: tracks.date,
        storage_source_id: tracks.storage_source_id,
      })
      .from(tracks)
      .leftJoin(artists, eq(tracks.artist_id, artists.id))
      .leftJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(albumArtist, eq(albums.artist_id, albumArtist.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .all() as SyncTrackSnapshot[];
  },

  countByStorageSource(id: number): number {
    const row = db()
      .select({ value: count() })
      .from(tracks)
      .where(eq(tracks.storage_source_id, id))
      .get();
    return row?.value ?? 0;
  },

  getByArtistAlbumTitle(
    artist: string,
    album: string,
    title: string,
  ): DBTrackWithRelations | undefined {
    return db()
      .select(dBTrackWithRelations)
      .from(tracks)
      .leftJoin(artists, eq(tracks.artist_id, artists.id))
      .leftJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .where(
        and(
          sql`${artists.name} COLLATE NOCASE = ${artist}`,
          eq(albums.title, album),
          eq(tracks.title, title),
        ),
      )
      .limit(1)
      .get() as DBTrackWithRelations | undefined;
  },

  search(query: string, limit = 100): DBTrackWithRelations[] {
    const pattern = `%${query}%`;
    return db()
      .select(dBTrackWithRelations)
      .from(tracks)
      .leftJoin(artists, eq(tracks.artist_id, artists.id))
      .leftJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .where(
        or(
          like(tracks.title, pattern),
          like(artists.name, pattern),
          like(albums.title, pattern),
        ),
      )
      .orderBy(asc(tracks.title))
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },

  getByIdWithRelations(id: number): DBTrackWithRelations | undefined {
    return joinedOnArtistAndAlbum().where(eq(tracks.id, id)).get() as
      DBTrackWithRelations | undefined;
  },

  getByArtistWithRelations(artistId: number): DBTrackWithRelations[] {
    return joinedOnArtistAndAlbum()
      .where(eq(tracks.artist_id, artistId))
      .orderBy(asc(tracks.title))
      .all() as DBTrackWithRelations[];
  },

  getByAlbumWithRelations(albumId: number): DBTrackWithRelations[] {
    return dedupeAlbumTracks(
      db()
        .select({
          ...dBTrackWithRelations,
          storage_source_name: storageSources.name,
        })
        .from(tracks)
        .innerJoin(artists, eq(tracks.artist_id, artists.id))
        .innerJoin(albums, eq(tracks.album_id, albums.id))
        .leftJoin(genres, eq(tracks.genre_id, genres.id))
        .leftJoin(
          storageSources,
          eq(tracks.storage_source_id, storageSources.id),
        )
        .where(eq(tracks.album_id, albumId))
        .orderBy(
          asc(tracks.disc_number),
          asc(tracks.track_number),
          asc(tracks.title),
          asc(tracks.id),
        )
        .all() as DBTrackWithRelations[],
    );
  },
};
