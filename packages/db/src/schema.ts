import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { closeDb, db, initDb, sqlite } from "./connection.js";

// Resolved relative to this module, so it works under tsx (src/), tsc
// (dist/) and esbuild (bundle.cjs, via esbuild's import.meta.url shim).
const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../drizzle/", import.meta.url),
);

export async function initDatabase(path?: string): Promise<void> {
  console.log("🔧 Initializing database schema...");
  const dbPath = path ?? process.env.DB_PATH ?? "./data/music.db";
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
