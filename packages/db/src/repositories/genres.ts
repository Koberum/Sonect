import { asc, count, eq, like, sql } from "drizzle-orm";
import type { DBGenre } from "@repo/types";
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
  findOrCreate(name: string): number {
    return findOrCreateGenre(db(), name);
  },

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

  count(): number {
    const row = db().select({ value: count() }).from(genres).get();
    return row?.value ?? 0;
  },

  getById(id: number): DBGenre | undefined {
    return db().select().from(genres).where(eq(genres.id, id)).get() as
      DBGenre | undefined;
  },

  getByName(name: string): DBGenre | undefined {
    return db()
      .select()
      .from(genres)
      .where(sql`${genres.name} = ${name.trim()} COLLATE NOCASE`)
      .get() as DBGenre | undefined;
  },

  search(query: string, limit = 20): DBGenre[] {
    const pattern = `%${query}%`;
    return db()
      .select()
      .from(genres)
      .where(like(genres.name, pattern))
      .orderBy(asc(genres.name))
      .limit(limit)
      .all() as DBGenre[];
  },
};
