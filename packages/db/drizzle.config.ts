import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

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
