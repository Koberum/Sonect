import { initDb, sqlite, transaction } from "./connection.js";

const LATEST_VERSION = 3;

export async function initDatabase(path?: string): Promise<void> {
  console.log("🔧 Initializing database schema...");
  initDb(path);

  const version = readVersion();
  // A brand-new database has no version row and no library tables. Legacy
  // databases created before versioning also have no version row, but they do
  // have tables — they must run the migration chain, not be stamped as fresh.
  const freshDatabase = version === undefined && !hasTable("artists");

  createTables();
  ensureLegacyColumns();

  if (freshDatabase) {
    recordVersion(LATEST_VERSION);
  } else {
    const current = version ?? 1;
    if (current < 2) {
      transaction(migrateV1toV2);
      recordVersion(2);
    }
    if (current < 3) {
      transaction(migrateV2toV3);
      recordVersion(3);
    }
  }

  console.log("✅ Database schema initialized");
}

function hasTable(name: string): boolean {
  const row = sqlite()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return row !== undefined;
}

function hasColumn(table: string, column: string): boolean {
  const columns = sqlite().prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return columns.some((entry) => entry.name === column);
}

function readVersion(): number | undefined {
  if (!hasTable("schema_version")) return undefined;
  const row = sqlite()
    .prepare("SELECT MAX(version) as version FROM schema_version")
    .get() as { version: number | null } | undefined;
  return row?.version ?? undefined;
}

function recordVersion(version: number): void {
  sqlite()
    .prepare("INSERT INTO schema_version (version) VALUES (?)")
    .run(version);
}

// Complete idempotent DDL for the current schema. CREATE IF NOT EXISTS keeps
// this safe on every init, including databases that predate newer tables.
function createTables(): void {
  // Artists table
  sqlite().exec(`
    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Albums table
  sqlite().exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist_id INTEGER,
      artist_name TEXT,
      date TEXT,
      genre TEXT,
      cover_path TEXT,
      last_played TEXT,
      year INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
    );
  `);

  // Tracks table
  sqlite().exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      artist_id INTEGER,
      album_id INTEGER,
      track_number INTEGER,
      disc_number INTEGER,
      duration REAL,
      date TEXT,
      genre TEXT,
      composer TEXT,
      performer TEXT,
      comment TEXT,
      last_modified TEXT,
      play_count INTEGER DEFAULT 0,
      last_played TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
    );
  `);

  // Playlists table
  sqlite().exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Playlist tracks junction table
  sqlite().exec(`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      track_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
      UNIQUE(playlist_id, track_id)
    );
  `);

  // Create indexes for better query performance
  sqlite().exec(`
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_file ON tracks(file);
    CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
  `);

  // Sync metadata table - to track last sync
  sqlite().exec(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Storage sources table - SMB/NFS mount configs
  sqlite().exec(`
    CREATE TABLE IF NOT EXISTS storage_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('smb', 'nfs', 'local')),
      uri TEXT NOT NULL,
      mount_path TEXT NOT NULL,
      username TEXT,
      password TEXT,
      enabled INTEGER DEFAULT 1,
      file_count INTEGER DEFAULT 0,
      dir_count INTEGER DEFAULT 0,
      total_size INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Schema versioning - records completed migrations
  sqlite().exec(
    `CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`,
  );

  // Setup wizard progress
  sqlite().exec(`
    CREATE TABLE IF NOT EXISTS setup_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step TEXT NOT NULL UNIQUE,
      completed INTEGER DEFAULT 0,
      completed_at TEXT
    );
  `);
}

// Column additions for installs that predate the versioned migrations. The
// storage_sources columns were once patched ad hoc with empty catch blocks;
// hasTable/hasColumn checks replace those silent failures.
function ensureLegacyColumns(): void {
  ensureColumn("storage_sources", "username", "username TEXT");
  ensureColumn("storage_sources", "password", "password TEXT");
  ensureColumn("storage_sources", "file_count", "file_count INTEGER DEFAULT 0");
  ensureColumn("storage_sources", "dir_count", "dir_count INTEGER DEFAULT 0");
  ensureColumn("storage_sources", "total_size", "total_size INTEGER DEFAULT 0");
}

function ensureColumn(table: string, column: string, definition: string): void {
  if (hasTable(table) && !hasColumn(table, column)) {
    sqlite().exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

// Migration: merge case-insensitive duplicate artists
function migrateV1toV2(): void {
  const duplicates = sqlite()
    .prepare(
      `SELECT LOWER(name) as normalized, MIN(id) as keep_id
       FROM artists GROUP BY LOWER(name) HAVING COUNT(*) > 1`,
    )
    .all() as { normalized: string; keep_id: number }[];

  for (const dup of duplicates) {
    const dupeIds = (
      sqlite()
        .prepare("SELECT id FROM artists WHERE LOWER(name) = ? AND id != ?")
        .all(dup.normalized, dup.keep_id) as { id: number }[]
    ).map((r) => r.id);

    if (dupeIds.length === 0) continue;

    const placeholders = dupeIds.map(() => "?").join(",");
    sqlite()
      .prepare(
        `UPDATE tracks SET artist_id = ? WHERE artist_id IN (${placeholders})`,
      )
      .run(dup.keep_id, ...dupeIds);
    sqlite()
      .prepare(
        `UPDATE albums SET artist_id = ? WHERE artist_id IN (${placeholders})`,
      )
      .run(dup.keep_id, ...dupeIds);
    sqlite()
      .prepare(`DELETE FROM artists WHERE id IN (${placeholders})`)
      .run(...dupeIds);
  }
}

// Migration: add play tracking columns
function migrateV2toV3(): void {
  ensureColumn("tracks", "play_count", "play_count INTEGER DEFAULT 0");
  ensureColumn("tracks", "last_played", "last_played TEXT");
  ensureColumn("albums", "last_played", "last_played TEXT");
}

export default initDatabase;
