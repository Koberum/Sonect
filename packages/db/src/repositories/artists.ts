import {
  and,
  asc,
  count,
  eq,
  inArray,
  isNotNull,
  like,
  sql,
} from "drizzle-orm";
import type { DBArtist } from "@repo/types";
import { db } from "../connection.js";
import { albums, artists } from "../tables.js";
import { normalizeRowId, type QueryExecutor } from "./rowId.js";

// Shared with tracks.ts so an upsert inside a transaction resolves artists on
// the same executor instead of the global handle.
export function findOrCreateArtist(
  executor: QueryExecutor,
  name: string,
): number {
  const existing = executor
    .select({ id: artists.id })
    .from(artists)
    .where(sql`${artists.name} = ${name} COLLATE NOCASE`)
    .get();
  if (existing) return existing.id;

  const result = executor.insert(artists).values({ name }).run();
  return normalizeRowId(result.lastInsertRowid);
}

// Artists created only as track artists (e.g. collaboration credits) have no
// album of their own and would open an empty artist page. Catalog listings,
// search, and the dashboard's recent artists opt into this filter; the
// repository default stays unfiltered for lookups and maintenance.
export function artistsWithAlbums() {
  return inArray(
    artists.id,
    db()
      .select({ id: albums.artist_id })
      .from(albums)
      .where(isNotNull(albums.artist_id)),
  );
}

export const artistsDb = {
  getAll({
    limit,
    offset,
    withAlbumsOnly = false,
  }: {
    limit?: number;
    offset?: number;
    withAlbumsOnly?: boolean;
  } = {}): DBArtist[] {
    let query = db()
      .select()
      .from(artists)
      .orderBy(asc(artists.name))
      .$dynamic();
    if (withAlbumsOnly) {
      query = query.where(artistsWithAlbums());
    }
    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.offset(offset);
      }
    }
    return query.all() as DBArtist[];
  },

  count({ withAlbumsOnly = false }: { withAlbumsOnly?: boolean } = {}): number {
    let query = db().select({ value: count() }).from(artists).$dynamic();
    if (withAlbumsOnly) {
      query = query.where(artistsWithAlbums());
    }
    const row = query.get();
    return row?.value ?? 0;
  },

  getById(id: number): DBArtist | undefined {
    return db().select().from(artists).where(eq(artists.id, id)).get() as
      DBArtist | undefined;
  },

  search(
    query: string,
    limit = 20,
    { withAlbumsOnly = false }: { withAlbumsOnly?: boolean } = {},
  ): DBArtist[] {
    const pattern = `%${query}%`;
    const conditions = [like(artists.name, pattern)];
    if (withAlbumsOnly) {
      conditions.push(artistsWithAlbums());
    }
    return db()
      .select()
      .from(artists)
      .where(and(...conditions))
      .orderBy(asc(artists.name))
      .limit(limit)
      .all() as DBArtist[];
  },
};
