import { fileURLToPath } from "node:url";

// Resolved relative to this module, so it works under tsx (src/), tsc
// (dist/) and esbuild (bundle.cjs, via esbuild's import.meta.url shim).
export const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../drizzle/", import.meta.url),
);

export function resolveDbPath(path?: string): string {
  return path ?? process.env.DB_PATH ?? "./data/music.db";
}
