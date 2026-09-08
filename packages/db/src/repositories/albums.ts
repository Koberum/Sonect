import {
  and,
  asc,
  count,
  desc,
  eq,
  isNull,
  isNotNull,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getColumns } from "drizzle-orm";
import type { DBAlbum } from "@repo/types";
import { db } from "../connection.js";
import { albums, artists, genres, tracks } from "../tables.js";
import { normalizeRowId, type QueryExecutor } from "./rowId.js";
import { findOrCreateGenre } from "./genres.js";

// Album rows joined with their artist name, as consumed by the album APIs.
// The name lives only on artists (no denormalized albums.artist_name
// column); every album read joins it in so callers never fetch artists
// one by one.
export type AlbumWithArtist = DBAlbum & {
  artist_name: string;
  genre?: string;
};

const albumWithArtist = {
  ...getColumns(albums),
  // Coalesced so the API keeps the Track convention ("" when unknown) and
  // the type stays an honest string even for artistless albums.
  artist_name: sql<string>`coalesce(${artists.name}, '')`,
  genre: genres.name,
};

// Shared with tracks.ts so an upsert inside a transaction resolves albums on
// the same executor instead of the global handle. Album identity stays
// title-only and case-insensitive; an explicit artist on an existing album is
// reassigned, and a new genre only fills a NULL genre.
export function findOrCreateAlbum(
  executor: QueryExecutor,
  title: string,
  artistId?: number,
  year?: number,
  genre?: string | number,
): number {
  const resolvedGenreId =
    typeof genre === "number"
      ? genre
      : typeof genre === "string" && genre.trim() !== ""
        ? findOrCreateGenre(executor, genre)
        : undefined;

  const existing = executor
    .select({
      id: albums.id,
      artist_id: albums.artist_id,
      genre_id: albums.genre_id,
    })
    .from(albums)
    .where(sql`${albums.title} = ${title} COLLATE NOCASE`)
    .limit(1)
    .get();

  if (existing) {
    if (artistId && existing.artist_id !== artistId) {
      executor
        .update(albums)
        .set({ artist_id: artistId })
        .where(eq(albums.id, existing.id))
        .run();
    }
    if (resolvedGenreId !== undefined && existing.genre_id === null) {
      executor
        .update(albums)
        .set({ genre_id: resolvedGenreId })
        .where(and(eq(albums.id, existing.id), isNull(albums.genre_id)))
        .run();
    }
    return existing.id;
  }

  const result = executor
    .insert(albums)
    .values({
      title,
      artist_id: artistId ?? null,
      year: year ?? null,
      genre_id: resolvedGenreId ?? null,
    })
    .run();
  return normalizeRowId(result.lastInsertRowid);
}

export const albumsDb = {
  findOrCreate(
    title: string,
    artistId?: number,
    year?: number,
    genre?: string | number,
  ): number {
    return findOrCreateAlbum(db(), title, artistId, year, genre);
  },

  getAll({
    sort,
    limit,
    offset,
  }: {
    sort?: string;
    limit?: number;
    offset?: number;
  } = {}): AlbumWithArtist[] {
    const orderBy =
      sort === "year"
        ? [desc(albums.year), asc(albums.title)]
        : sort === "recent"
          ? [desc(albums.created_at)]
          : [asc(albums.title)];
    let query = db()
      .select(albumWithArtist)
      .from(albums)
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .orderBy(...orderBy)
      .$dynamic();
    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.offset(offset);
      }
    }
    return query.all() as AlbumWithArtist[];
  },

  count(): number {
    const row = db().select({ value: count() }).from(albums).get();
    return row?.value ?? 0;
  },

  getRecent(limit: number): AlbumWithArtist[] {
    return db()
      .select(albumWithArtist)
      .from(albums)
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .orderBy(desc(albums.created_at))
      .limit(limit)
      .all() as AlbumWithArtist[];
  },

  getById(id: number): AlbumWithArtist | undefined {
    return db()
      .select(albumWithArtist)
      .from(albums)
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .where(eq(albums.id, id))
      .get() as AlbumWithArtist | undefined;
  },

  getByGenre(genre: string): AlbumWithArtist[] {
    return db()
      .select(albumWithArtist)
      .from(albums)
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .where(sql`${genres.name} = ${genre} COLLATE NOCASE`)
      .orderBy(asc(albums.title))
      .all() as AlbumWithArtist[];
  },

  getByArtist(artistId: number): AlbumWithArtist[] {
    return db()
      .select(albumWithArtist)
      .from(albums)
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .where(eq(albums.artist_id, artistId))
      .orderBy(asc(albums.year), asc(albums.title))
      .all() as AlbumWithArtist[];
  },

  getRankedByPlayCount({
    artistId,
    genre,
    genreId,
  }: {
    artistId?: number;
    genre?: string;
    genreId?: number;
  } = {}): AlbumWithArtist[] {
    const conditions = [
      artistId !== undefined ? eq(albums.artist_id, artistId) : undefined,
      genreId !== undefined
        ? eq(albums.genre_id, genreId)
        : genre !== undefined
          ? sql`${genres.name} = ${genre} COLLATE NOCASE`
          : undefined,
    ];
    // Aggregate ranking stays in SQL: total plays per album, then title
    // case-insensitively, then insertion order.
    const totalPlays = sql<number>`coalesce(sum(${tracks.play_count}), 0)`;
    return db()
      .select(albumWithArtist)
      .from(albums)
      .leftJoin(tracks, eq(tracks.album_id, albums.id))
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .where(and(...conditions))
      .groupBy(albums.id)
      .orderBy(desc(totalPlays), sql`${albums.title} COLLATE NOCASE`, albums.id)
      .all() as AlbumWithArtist[];
  },

  search(query: string, limit = 20): AlbumWithArtist[] {
    const pattern = `%${query}%`;
    return db()
      .selectDistinct(albumWithArtist)
      .from(albums)
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .where(or(like(albums.title, pattern), like(artists.name, pattern)))
      .orderBy(asc(albums.title))
      .limit(limit)
      .all() as AlbumWithArtist[];
  },

  getCoverPreviews(artistId: number, limit: number): string[] {
    return db()
      .select({ cover_path: albums.cover_path })
      .from(albums)
      .where(
        and(
          eq(albums.artist_id, artistId),
          isNotNull(albums.cover_path),
          ne(albums.cover_path, ""),
        ),
      )
      .limit(limit)
      .all()
      .map((row) => row.cover_path as string);
  },

  getByTitleAndArtist(
    title: string,
    artistName: string,
  ): AlbumWithArtist | undefined {
    return db()
      .select(albumWithArtist)
      .from(albums)
      .innerJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .where(
        and(
          eq(albums.title, title),
          sql`${artists.name} COLLATE NOCASE = ${artistName}`,
        ),
      )
      .limit(1)
      .get() as AlbumWithArtist | undefined;
  },

  updateCoverPath(albumId: number, coverPath: string): void {
    db()
      .update(albums)
      .set({ cover_path: coverPath })
      .where(eq(albums.id, albumId))
      .run();
  },

  updateLastPlayed(albumId: number): void {
    db()
      .update(albums)
      .set({ last_played: sql`datetime('now')` })
      .where(eq(albums.id, albumId))
      .run();
  },

  getRecentAlbums(limit: number, excludeAlbumId?: number): AlbumWithArtist[] {
    const conditions = [
      excludeAlbumId !== undefined ? ne(albums.id, excludeAlbumId) : undefined,
      isNotNull(albums.last_played),
    ];
    return db()
      .select(albumWithArtist)
      .from(albums)
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .where(and(...conditions))
      .orderBy(desc(albums.last_played))
      .limit(limit)
      .all() as AlbumWithArtist[];
  },
};
