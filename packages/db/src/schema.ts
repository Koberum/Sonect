import { db, initDb } from "./connection.js";

export async function initDatabase() {
  console.log("🔧 Initializing database schema...");
  await initDb();

  // Artists table
  db().exec(`
    CREATE TABLE IF NOT EXISTS artists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      sort_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Albums table
  db().exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      artist_id INTEGER,
      artist_name TEXT,
      year INTEGER,
      date TEXT,
      genre TEXT,
      cover_path TEXT,
      last_played TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
    );
  `);

  // Tracks table
  db().exec(`
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
      last_modified DATETIME,
      play_count INTEGER DEFAULT 0,
      last_played TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
    );
  `);

  // Playlists table
  db().exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Playlist tracks junction table
  db().exec(`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      track_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
      UNIQUE(playlist_id, track_id)
    );
  `);

  // Create indexes for better query performance
  db().exec(`
    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
    CREATE INDEX IF NOT EXISTS idx_tracks_file ON tracks(file);
    CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
  `);

  // Sync metadata table - to track last sync
  db().exec(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Storage sources table - SMB/NFS mount configs
  db().exec(`
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: add username/password if missing (existing installs)
  try {
    db().exec("ALTER TABLE storage_sources ADD COLUMN username TEXT");
  } catch {}
  try {
    db().exec("ALTER TABLE storage_sources ADD COLUMN password TEXT");
  } catch {}
  // Migration: add per-source library stats (existing installs)
  try {
    db().exec(
      "ALTER TABLE storage_sources ADD COLUMN file_count INTEGER DEFAULT 0",
    );
  } catch {}
  try {
    db().exec(
      "ALTER TABLE storage_sources ADD COLUMN dir_count INTEGER DEFAULT 0",
    );
  } catch {}
  try {
    db().exec(
      "ALTER TABLE storage_sources ADD COLUMN total_size INTEGER DEFAULT 0",
    );
  } catch {}

  // Migration: merge case-insensitive duplicate artists
  function migrateV1toV2() {
    const duplicates = db()
      .prepare(
        `SELECT LOWER(name) as normalized, MIN(id) as keep_id
       FROM artists GROUP BY LOWER(name) HAVING COUNT(*) > 1`,
      )
      .all() as { normalized: string; keep_id: number }[];

    for (const dup of duplicates) {
      const dupeIds = (
        db()
          .prepare("SELECT id FROM artists WHERE LOWER(name) = ? AND id != ?")
          .all(dup.normalized, dup.keep_id) as { id: number }[]
      ).map((r) => r.id);

      if (dupeIds.length === 0) continue;

      const placeholders = dupeIds.map(() => "?").join(",");
      db()
        .prepare(
          `UPDATE tracks SET artist_id = ? WHERE artist_id IN (${placeholders})`,
        )
        .run(dup.keep_id, ...dupeIds);
      db()
        .prepare(
          `UPDATE albums SET artist_id = ? WHERE artist_id IN (${placeholders})`,
        )
        .run(dup.keep_id, ...dupeIds);
      db()
        .prepare(`DELETE FROM artists WHERE id IN (${placeholders})`)
        .run(...dupeIds);
    }
  }

  // Migration: add play tracking columns
  function migrateV2toV3() {
    try {
      db().exec("ALTER TABLE tracks ADD COLUMN play_count INTEGER DEFAULT 0");
    } catch {}
    try {
      db().exec("ALTER TABLE tracks ADD COLUMN last_played TEXT");
    } catch {}
    try {
      db().exec("ALTER TABLE albums ADD COLUMN last_played TEXT");
    } catch {}
  }

  // Schema versioning — used for future versioned migrations
  db().exec(
    `CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`,
  );
  const row = db()
    .prepare("SELECT MAX(version) as version FROM schema_version")
    .get() as { version: number | null } | undefined;
  const current = row?.version;
  const latest = 3;
  if (!current) {
    db().prepare("INSERT INTO schema_version (version) VALUES (?)").run(latest);
  } else if (current < latest) {
    if (current < 2) {
      migrateV1toV2();
    }
    if (current < 3) {
      migrateV2toV3();
    }
  }

  // Setup wizard progress
  db().exec(`
    CREATE TABLE IF NOT EXISTS setup_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      step TEXT NOT NULL UNIQUE,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME
    );
  `);

  console.log("✅ Database schema initialized");
}

export default initDatabase;
