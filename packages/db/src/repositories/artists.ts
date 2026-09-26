import { asc, count, eq, like, sql } from "drizzle-orm";
import type { DBArtist } from "@repo/types";
import { db } from "../connection.js";
import { artists } from "../tables.js";
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

export const artistsDb = {
  findOrCreate(name: string): number {
    return findOrCreateArtist(db(), name);
  },

  getAll({
    limit,
    offset,
  }: { limit?: number; offset?: number } = {}): DBArtist[] {
    let query = db()
      .select()
      .from(artists)
      .orderBy(asc(artists.name))
      .$dynamic();
    if (limit !== undefined) {
      query = query.limit(limit);
      if (offset !== undefined) {
        query = query.offset(offset);
      }
    }
    return query.all() as DBArtist[];
  },

  count(): number {
    const row = db().select({ value: count() }).from(artists).get();
    return row?.value ?? 0;
  },

  getById(id: number): DBArtist | undefined {
    return db().select().from(artists).where(eq(artists.id, id)).get() as
      DBArtist | undefined;
  },

  search(query: string, limit = 20): DBArtist[] {
    const pattern = `%${query}%`;
    return db()
      .select()
      .from(artists)
      .where(like(artists.name, pattern))
      .orderBy(asc(artists.name))
      .limit(limit)
      .all() as DBArtist[];
  },
};
