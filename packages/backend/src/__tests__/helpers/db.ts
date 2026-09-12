import { closeDb, initDb, db } from "@repo/db";
import { MIGRATIONS_FOLDER } from "@repo/db/migrations";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

/**
 * Creates a fresh in-memory SQLite database running REAL migrations.
 * Synchronous, millisecond creation - fresh per test/file, throw away after.
 *
 * Each call closes any previous global DB (singleton in @repo/db) then
 * re-initializes with :memory:.
 */
export function createTestDb() {
  try {
    closeDb();
  } catch {
    // ignore if not initialized
  }
  const orm = initDb(":memory:");
  migrate(db(), { migrationsFolder: MIGRATIONS_FOLDER });
  return {
    db: orm,
    close: () => closeDb(),
  };
}
