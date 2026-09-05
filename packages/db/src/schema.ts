import { rmSync } from "node:fs";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { closeDb, db, initDb, sqlite } from "./connection.js";
import { MIGRATIONS_FOLDER, resolveDbPath } from "./migrations.js";

export async function initDatabase(path?: string): Promise<void> {
  console.log("🔧 Initializing database schema...");
  const dbPath = resolveDbPath(path);
  initDb(path);

  if (isLegacyDatabase()) {
    console.log(
      "🧨 Pre-migrator database detected — wiping for fresh v1 schema",
    );
    closeDb();
    for (const suffix of ["", "-wal", "-shm"]) {
      rmSync(`${dbPath}${suffix}`, { force: true });
    }
    initDb(path);
  }

  migrate(db(), { migrationsFolder: MIGRATIONS_FOLDER });
  console.log("✅ Database schema initialized");
}

// Databases created by the retired schema_version chain have our tables but
// no __drizzle_migrations bookkeeping; the migrator cannot adopt them.
function isLegacyDatabase(): boolean {
  return !hasTable("__drizzle_migrations") && hasTable("artists");
}

function hasTable(name: string): boolean {
  return (
    sqlite()
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(name) !== undefined
  );
}

export default initDatabase;
