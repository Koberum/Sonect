import { createInterface } from "node:readline/promises";
import { rmSync } from "node:fs";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { closeDb, db, initDb } from "../connection.js";
import { MIGRATIONS_FOLDER, resolveDbPath } from "../migrations.js";

const force = process.argv.some((arg) => arg === "--force" || arg === "-y");
const dbPath = resolveDbPath();

if (!force) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `⚠️  This deletes ${dbPath} (and -wal/-shm) and rebuilds the schema. All data is lost. Continue? (y/N) `,
  );
  rl.close();
  if (answer.trim().toLowerCase() !== "y") {
    console.log("Aborted");
    process.exit(0);
  }
}

console.log(`🧨 Deleting ${dbPath}`);
closeDb();
for (const suffix of ["", "-wal", "-shm"]) {
  rmSync(`${dbPath}${suffix}`, { force: true });
}

initDb(dbPath);
migrate(db(), { migrationsFolder: MIGRATIONS_FOLDER });
closeDb();
console.log("✅ Database rebuilt from scratch");
