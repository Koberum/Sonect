import {
  and,
  asc,
  desc,
  eq,
  getColumns,
  isNull,
  isNotNull,
  like,
  lt,
  notInArray,
  or,
  sql,
  count,
  countDistinct,
  inArray,
} from "drizzle-orm";
import type { DBTrack, MPDTrack, DBTrackWithRelations } from "@repo/types";
import { db, transaction } from "../connection.js";
import { albums, artists, genres, tracks } from "../tables.js";
import { normalizeRowId, type QueryExecutor } from "./rowId.js";
import { findOrCreateArtist } from "./artists.js";
import { findOrCreateAlbum } from "./albums.js";
import { findOrCreateGenre } from "./genres.js";

const dBTrackWithRelations = {
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
function trackNumberOf(track: MPDTrack): number | null {
  return track.track ? parseInt(track.track.toString().split("/")[0]) : null;
}

function discNumberOf(track: MPDTrack): number | null {
  return track.disc ? parseInt(track.disc.toString()) : null;
}

function yearOf(track: MPDTrack): number | undefined {
  return track.date ? parseInt(track.date.split("-")[0]) : undefined;
}

// Single definition used by tracksDb.upsert() and by the transactional
// library rebuild: playback statistics are never touched here, only metadata.
export function upsertTrack(executor: QueryExecutor, track: MPDTrack): number {
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
        date: track.date ?? null,
        last_modified: track.lastModified ?? null,
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
      date: track.date ?? null,
      last_modified: track.lastModified ?? null,
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

  getTopTracks(limit: number, offset = 0): DBTrackWithRelations[] {
    return joinedOnArtistAndAlbum()
      .orderBy(desc(tracks.play_count), desc(tracks.last_played))
      .limit(limit)
      .offset(offset)
      .all() as DBTrackWithRelations[];
  },

  getRecentlyPlayed(limit: number): DBTrackWithRelations[] {
    return joinedOnArtistAndAlbum()
      .where(isNotNull(tracks.last_played))
      .orderBy(desc(tracks.last_played))
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },

  getTracksForDiscovery(
    genreNames: string[],
    artistIds: number[],
    limit: number,
  ): DBTrackWithRelations[] {
    // The raw SQL matched `genre IN (...) OR artist_id IN (...)`; an empty
    // SQLite IN list is always false, so both lists empty matches nothing.
    if (genreNames.length === 0 && artistIds.length === 0) return [];
    const scope = or(
      genreNames.length > 0 ? inArray(genres.name, genreNames) : undefined,
      artistIds.length > 0 ? inArray(tracks.artist_id, artistIds) : undefined,
    );
    return joinedOnArtistAndAlbum()
      .where(
        and(scope, or(isNull(tracks.play_count), lt(tracks.play_count, 3))),
      )
      .orderBy(sql`random()`)
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },

  getTopGenres(limit: number): string[] {
    const total = sql<number>`sum(${tracks.play_count})`;
    return db()
      .select({ genre: genres.name })
      .from(tracks)
      .innerJoin(genres, eq(tracks.genre_id, genres.id))
      .groupBy(genres.id, genres.name)
      .orderBy(desc(total))
      .limit(limit)
      .all()
      .map((row) => row.genre);
  },

  getTopArtists(limit: number): { id: number; name: string; total: number }[] {
    const total = sql<number>`coalesce(sum(${tracks.play_count}), 0)`;
    return db()
      .select({ id: artists.id, name: artists.name, total })
      .from(artists)
      .innerJoin(tracks, eq(tracks.artist_id, artists.id))
      .groupBy(artists.id)
      .orderBy(desc(total))
      .limit(limit)
      .all() as { id: number; name: string; total: number }[];
  },

  getTopGenre(): string | null {
    const total = sql<number>`sum(${tracks.play_count})`;
    const row = db()
      .select({ genre: genres.name })
      .from(tracks)
      .innerJoin(genres, eq(tracks.genre_id, genres.id))
      .groupBy(genres.id, genres.name)
      .orderBy(desc(total))
      .limit(1)
      .get();
    return row?.genre || null;
  },

  getTracksByGenre(genre: string, limit: number): DBTrackWithRelations[] {
    return joinedOnArtistAndAlbum()
      .where(sql`${genres.name} = ${genre} COLLATE NOCASE`)
      .orderBy(desc(tracks.play_count))
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },

  upsert(track: MPDTrack): number {
    return transaction((tx) => upsertTrack(tx, track));
  },

  count(): number {
    const row = db().select({ value: count() }).from(tracks).get();
    return row?.value ?? 0;
  },

  getRecentWithRelations(limit: number): DBTrackWithRelations[] {
    return joinedOnArtistAndAlbum()
      .orderBy(desc(tracks.created_at))
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },

  getGenres(): { genre: string; track_count: number; album_count: number }[] {
    return db()
      .select({
        genre: genres.name,
        track_count: count(tracks.id),
        album_count: countDistinct(tracks.album_id),
      })
      .from(tracks)
      .innerJoin(genres, eq(tracks.genre_id, genres.id))
      .groupBy(genres.id, genres.name)
      .orderBy(asc(genres.name))
      .all() as { genre: string; track_count: number; album_count: number }[];
  },

  getByGenre(genre: string): DBTrack[] {
    return db()
      .select(getColumns(tracks))
      .from(tracks)
      .innerJoin(genres, eq(tracks.genre_id, genres.id))
      .where(sql`${genres.name} = ${genre} COLLATE NOCASE`)
      .orderBy(asc(tracks.title))
      .all() as DBTrack[];
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

  getByArtist(artistId: number): DBTrack[] {
    return db()
      .select()
      .from(tracks)
      .where(eq(tracks.artist_id, artistId))
      .orderBy(asc(tracks.title))
      .all() as DBTrack[];
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
    return db()
      .select()
      .from(tracks)
      .where(eq(tracks.album_id, albumId))
      .orderBy(asc(tracks.disc_number), asc(tracks.track_number))
      .all() as DBTrack[];
  },

  getByFile(file: string): DBTrack | undefined {
    return db().select().from(tracks).where(eq(tracks.file, file)).get() as
      DBTrack | undefined;
  },

  getRandomTracks(limit: number, excludeFiles?: string[]): DBTrack[] {
    let query = db().select().from(tracks).$dynamic();
    if (excludeFiles && excludeFiles.length > 0) {
      query = query.where(notInArray(tracks.file, excludeFiles));
    }
    return query
      .orderBy(sql`random()`)
      .limit(limit)
      .all() as DBTrack[];
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

  deleteByFile(file: string): void {
    db().delete(tracks).where(eq(tracks.file, file)).run();
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
    return joinedOnArtistAndAlbum()
      .where(eq(tracks.album_id, albumId))
      .orderBy(
        asc(tracks.disc_number),
        asc(tracks.track_number),
        asc(tracks.title),
      )
      .all() as DBTrackWithRelations[];
  },

  getAllWithRelations(
    sort?: string,
    limit?: number,
    offset?: number,
  ): DBTrackWithRelations[] {
    const orderBy =
      sort === "recent"
        ? [desc(tracks.created_at)]
        : sort === "duration"
          ? [desc(tracks.duration)]
          : [asc(tracks.title)];
    let query = db()
      .select(dBTrackWithRelations)
      .from(tracks)
      .leftJoin(artists, eq(tracks.artist_id, artists.id))
      .leftJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .orderBy(...orderBy)
      .$dynamic();
    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.offset(offset);
      }
    }
    return query.all() as DBTrackWithRelations[];
  },
};
