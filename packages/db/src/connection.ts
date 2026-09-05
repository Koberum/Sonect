import "dotenv/config";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import * as schema from "./tables.js";

export type DrizzleDatabase = NodeSQLiteDatabase<typeof schema> & {
  $client: DatabaseSync;
};
export type DatabaseTransaction = Parameters<
  Parameters<DrizzleDatabase["transaction"]>[0]
>[0];

let client: DatabaseSync | undefined;
let orm: DrizzleDatabase | undefined;
let currentPath: string | undefined;

export function initDb(path = process.env.DB_PATH ?? "./data/music.db") {
  if (orm) {
    if (path !== currentPath) throw new Error("Database already initialized");
    return orm;
  }
  if (path !== ":memory:" && !existsSync(dirname(path))) {
    mkdirSync(dirname(path), { recursive: true });
  }
  client = new DatabaseSync(path);
  client.exec("PRAGMA foreign_keys = ON");
  client.exec("PRAGMA journal_mode = WAL");
  client.exec("PRAGMA synchronous = NORMAL");
  client.exec("PRAGMA busy_timeout = 5000");
  orm = drizzle({ client });
  currentPath = path;
  return orm;
}

export function db(): DrizzleDatabase {
  if (!orm) throw new Error("Database not initialized. Call initDb() first.");
  return orm;
}

export function sqlite(): DatabaseSync {
  if (!client)
    throw new Error("Database not initialized. Call initDb() first.");
  return client;
}

export function transaction<T>(work: (tx: DatabaseTransaction) => T): T {
  // Drizzle's sync-driver callback type conditionally rejects Promise returns,
  // which TypeScript cannot decide for a generic T even though the runtime
  // contract accepts any synchronous result; cast the callback to keep this
  // wrapper generic.
  return db().transaction(work as never);
}

export function closeDb(): void {
  if (!client) return;
  if (currentPath !== ":memory:")
    client.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  client.close();
  client = undefined;
  orm = undefined;
  currentPath = undefined;
}
