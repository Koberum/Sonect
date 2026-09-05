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
import { albums, artists, tracks } from "../tables.js";
import { normalizeRowId, type QueryExecutor } from "./rowId.js";

// Shared with tracks.ts so an upsert inside a transaction resolves albums on
// the same executor instead of the global handle. Album identity stays
// title-only and case-insensitive; an explicit artist on an existing album is
// reassigned, and a new genre only fills a NULL genre.
export function findOrCreateAlbum(
  executor: QueryExecutor,
  title: string,
  artistId?: number,
  year?: number,
  genre?: string,
): number {
  const existing = executor
    .select({ id: albums.id, artist_id: albums.artist_id })
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
    if (genre) {
      executor
        .update(albums)
        .set({ genre })
        .where(and(eq(albums.id, existing.id), isNull(albums.genre)))
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
      genre: genre ?? null,
    })
    .run();
  return normalizeRowId(result.lastInsertRowid);
}

export const albumsDb = {
  findOrCreate(
    title: string,
    artistId?: number,
    year?: number,
    genre?: string,
  ): number {
    return findOrCreateAlbum(db(), title, artistId, year, genre);
  },

  getAll({
    sort,
    limit,
    offset,
  }: { sort?: string; limit?: number; offset?: number } = {}): DBAlbum[] {
    const orderBy =
      sort === "year"
        ? [desc(albums.year), asc(albums.title)]
        : sort === "recent"
          ? [desc(albums.created_at)]
          : [asc(albums.title)];
    let query = db()
      .select()
      .from(albums)
      .orderBy(...orderBy)
      .$dynamic();
    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.offset(offset);
      }
    }
    return query.all() as DBAlbum[];
  },

  count(): number {
    const row = db().select({ value: count() }).from(albums).get();
    return row?.value ?? 0;
  },

  getRecent(limit: number): DBAlbum[] {
    return db()
      .select()
      .from(albums)
      .orderBy(desc(albums.created_at))
      .limit(limit)
      .all() as DBAlbum[];
  },

  getById(id: number): DBAlbum | undefined {
    return db().select().from(albums).where(eq(albums.id, id)).get() as
      DBAlbum | undefined;
  },

  getByGenre(genre: string): DBAlbum[] {
    return db()
      .select()
      .from(albums)
      .where(eq(albums.genre, genre))
      .orderBy(asc(albums.title))
      .all() as DBAlbum[];
  },

  getByArtist(artistId: number): DBAlbum[] {
    return db()
      .select()
      .from(albums)
      .where(eq(albums.artist_id, artistId))
      .orderBy(asc(albums.year), asc(albums.title))
      .all() as DBAlbum[];
  },

  getRankedByPlayCount({
    artistId,
    genre,
  }: {
    artistId?: number;
    genre?: string;
  } = {}): DBAlbum[] {
    const conditions = [
      artistId !== undefined ? eq(albums.artist_id, artistId) : undefined,
      genre !== undefined ? eq(albums.genre, genre) : undefined,
    ];
    // Aggregate ranking stays in SQL: total plays per album, then title
    // case-insensitively, then insertion order.
    const totalPlays = sql<number>`coalesce(sum(${tracks.play_count}), 0)`;
    return db()
      .select()
      .from(albums)
      .leftJoin(tracks, eq(tracks.album_id, albums.id))
      .where(and(...conditions))
      .groupBy(albums.id)
      .orderBy(desc(totalPlays), sql`${albums.title} COLLATE NOCASE`, albums.id)
      .all()
      .map(({ albums }) => albums as DBAlbum);
  },

  search(query: string, limit = 20): DBAlbum[] {
    const pattern = `%${query}%`;
    return db()
      .selectDistinct(getColumns(albums))
      .from(albums)
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .where(or(like(albums.title, pattern), like(artists.name, pattern)))
      .orderBy(asc(albums.title))
      .limit(limit)
      .all() as DBAlbum[];
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

  getByTitleAndArtist(title: string, artistName: string): DBAlbum | undefined {
    return db()
      .select(getColumns(albums))
      .from(albums)
      .innerJoin(artists, eq(albums.artist_id, artists.id))
      .where(
        and(
          eq(albums.title, title),
          sql`${artists.name} COLLATE NOCASE = ${artistName}`,
        ),
      )
      .limit(1)
      .get() as DBAlbum | undefined;
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

  getRecentAlbums(limit: number, excludeAlbumId?: number): DBAlbum[] {
    const conditions = [
      excludeAlbumId !== undefined ? ne(albums.id, excludeAlbumId) : undefined,
      isNotNull(albums.last_played),
    ];
    return db()
      .select()
      .from(albums)
      .where(and(...conditions))
      .orderBy(desc(albums.last_played))
      .limit(limit)
      .all() as DBAlbum[];
  },
};
