import { asc, count, eq, sql } from "drizzle-orm";
import type { DBGenre, DBGenreWithCounts } from "@repo/types";
import { db } from "../connection.js";
import { genres } from "../tables.js";
import { normalizeRowId, type QueryExecutor } from "./rowId.js";

export function findOrCreateGenre(
  executor: QueryExecutor,
  name: string,
): number {
  const trimmed = name.trim();
  const existing = executor
    .select({ id: genres.id })
    .from(genres)
    .where(sql`${genres.name} = ${trimmed} COLLATE NOCASE`)
    .get();
  if (existing) return existing.id;

  const result = executor.insert(genres).values({ name: trimmed }).run();
  return normalizeRowId(result.lastInsertRowid);
}

export const genresDb = {
  getAll({
    limit,
    offset,
  }: { limit?: number; offset?: number } = {}): DBGenre[] {
    let query = db().select().from(genres).orderBy(asc(genres.name)).$dynamic();
    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.offset(offset);
      }
    }
    return query.all() as DBGenre[];
  },

  getAllWithCounts(): DBGenreWithCounts[] {
    return db()
      .select({
        id: genres.id,
        name: genres.name,
        created_at: genres.created_at,
        updated_at: genres.updated_at,
        track_count: sql<number>`(select count(*) from tracks where tracks.genre_id = genres.id)`,
        album_count: sql<number>`(select count(*) from albums where albums.genre_id = genres.id)`,
      })
      .from(genres)
      .orderBy(asc(genres.name))
      .all() as DBGenreWithCounts[];
  },

  count(): number {
    const row = db().select({ value: count() }).from(genres).get();
    return row?.value ?? 0;
  },

  getById(id: number): DBGenre | undefined {
    return db().select().from(genres).where(eq(genres.id, id)).get() as
      DBGenre | undefined;
  },
};
