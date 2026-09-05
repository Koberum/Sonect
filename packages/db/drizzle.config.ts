import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

// Studio browses the live dev database. The backend resolves DB_PATH
// relative to its own cwd (packages/backend), so the default here points
// at that file; an explicit DB_PATH is resolved from the repo root.
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const url = process.env.DB_PATH
  ? resolve(repoRoot, process.env.DB_PATH)
  : fileURLToPath(new URL("../backend/data/music.db", import.meta.url));

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/tables.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
