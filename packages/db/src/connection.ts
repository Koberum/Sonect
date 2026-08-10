import "dotenv/config";
import initSqlJs from "sql.js";
import { dirname, join, resolve } from "path";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { Buffer } from "buffer";

// Extracted for clarity; in the CJS bundle esbuild replaces import.meta.url
// via --define (see backend's bundle script), so this always resolves correctly.
const _thisDir: string = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || "./data/music.db";

const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// ── sql.js wrapper ──

interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

class StatementWrapper {
  private sql: string;
  private sqlDb: SqlJsDatabase;

  constructor(sql: string, sqlDb: SqlJsDatabase) {
    this.sql = sql;
    this.sqlDb = sqlDb;
  }

  get(...params: unknown[]): unknown {
    const stmt = this.sqlDb.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    const result: unknown = stmt.step() ? stmt.getAsObject() : undefined;
    stmt.free();
    return result;
  }

  all(...params: unknown[]): unknown[] {
    const stmt = this.sqlDb.prepare(this.sql);
    if (params.length > 0) stmt.bind(params);
    const results: unknown[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  run(...params: unknown[]): RunResult {
    this.sqlDb.run(this.sql, params);
    markDirty();

    const idStmt = this.sqlDb.prepare("SELECT last_insert_rowid() as id");
    idStmt.step();
    const { id: lastInsertRowid } = idStmt.getAsObject() as { id: number };
    idStmt.free();

    const chStmt = this.sqlDb.prepare("SELECT changes() as c");
    chStmt.step();
    const { c: changes } = chStmt.getAsObject() as { c: number };
    chStmt.free();

    return { lastInsertRowid, changes };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SqlJsDatabase = any;

class DatabaseWrapper {
  private sqlDb: SqlJsDatabase;

  constructor(sqlDb: SqlJsDatabase) {
    this.sqlDb = sqlDb;
  }

  prepare(sql: string): StatementWrapper {
    return new StatementWrapper(sql, this.sqlDb);
  }

  exec(sql: string): void {
    this.sqlDb.run(sql);
    markDirty();
  }

  pragma(sql: string): void {
    this.sqlDb.run(`PRAGMA ${sql}`);
  }

  close(): void {
    saveNow();
    this.sqlDb.close();
  }
}

// ── Persistence ─────────────────────────────────────

let dirty = false;
let saveScheduled = false;
let sqlDb: SqlJsDatabase | null = null;

function markDirty(): void {
  dirty = true;
  if (!saveScheduled) {
    saveScheduled = true;
    setImmediate(() => {
      saveScheduled = false;
      saveNow();
    });
  }
}

function saveNow(): void {
  if (!dirty || !sqlDb) return;
  const data = sqlDb.export();
  writeFileSync(DB_PATH, Buffer.from(data));
  dirty = false;
}

// ── Lazy async initialization ───────────────────────

let _db: DatabaseWrapper | null = null;
let _initPromise: Promise<void> | null = null;

export async function initDb(): Promise<DatabaseWrapper> {
  if (_db) return _db;
  if (!_initPromise) {
    _initPromise = (async () => {
      const SQL = await initSqlJs({
        locateFile: (file: string) => {
          const bundlePath = `${dirname(process.argv[1])}/${file}`;
          if (existsSync(bundlePath)) return bundlePath;

          const cwdPath = `${process.cwd()}/node_modules/sql.js/dist/${file}`;
          if (existsSync(cwdPath)) return cwdPath;

          // pnpm monorepo: check db package's own node_modules
          const dbNodeModules = resolve(
            _thisDir,
            "..",
            "node_modules",
            "sql.js",
            "dist",
            file,
          );
          if (existsSync(dbNodeModules)) return dbNodeModules;

          // final fallback — let sql.js try its own resolution
          return join(process.cwd(), "node_modules", "sql.js", "dist", file);
        },
      });

      const existingDb = existsSync(DB_PATH)
        ? new Uint8Array(readFileSync(DB_PATH))
        : undefined;

      sqlDb = new SQL.Database(existingDb);
      _db = new DatabaseWrapper(sqlDb);

      _db.pragma("foreign_keys = ON");
      _db.pragma("journal_mode = WAL");
      _db.pragma("synchronous = NORMAL");

      console.log(`📦 Database connected: ${DB_PATH}`);

      process.on("exit", () => _db!.close());
      process.on("SIGINT", () => {
        _db!.close();
        process.exit(0);
      });
    })();
  }
  await _initPromise;
  return _db!;
}

export function db(): DatabaseWrapper {
  if (!_db) throw new Error("Database not initialized. Call initDb() first.");
  return _db;
}
