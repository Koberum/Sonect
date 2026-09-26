import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { closeDb, db, initDb, sqlite } from "../connection.js";
import { MIGRATIONS_FOLDER, resolveDbPath } from "../migrations.js";

function appliedMigrations(): number {
  const row = sqlite()
    .prepare("SELECT COUNT(*) AS n FROM __drizzle_migrations")
    .get() as { n: number };
  return row.n;
}

const dbPath = resolveDbPath();
initDb(dbPath);

if (hasOurTables() && !hasTable("__drizzle_migrations")) {
  console.error(
    "❌ Legacy pre-migrator database detected.",
    "\n   Migrations cannot be applied on top of it.",
    "\n   Run `pnpm db:migrate-reset --force` to wipe it (data loss),",
    "\n   or start the backend once — it migrates legacy databases automatically.",
  );
  closeDb();
  process.exit(1);
}

const before = hasTable("__drizzle_migrations") ? appliedMigrations() : 0;
migrate(db(), { migrationsFolder: MIGRATIONS_FOLDER });
const after = appliedMigrations();
closeDb();

if (after === before) {
  console.log("✅ Database already up to date");
} else {
  console.log(`✅ Applied ${after - before} migration(s)`);
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

function hasOurTables(): boolean {
  return hasTable("artists");
}
