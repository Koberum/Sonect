import { afterEach, beforeEach, describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { closeDb, db, initDatabase } from "@repo/db";

const directories: string[] = [];

describe("database schema migration", () => {
  beforeEach(() => {
    // Tests may follow suites that left a connection open on another path;
    // initDatabase() must be free to open each fixture's own file.
    closeDb();
  });

  afterEach(() => {
    closeDb();
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("creates the complete version 3 schema in a new database", async () => {
    const path = temporaryDatabasePath();
    await initDatabase(path);
    const version = db()
      .$client.prepare("SELECT MAX(version) AS version FROM schema_version")
      .get() as { version: number };
    const trackColumns = db()
      .$client.prepare("PRAGMA table_info(tracks)")
      .all() as { name: string }[];
    expect(version.version).to.equal(3);
    expect(trackColumns.map(({ name }) => name)).to.include.members([
      "play_count",
      "last_played",
    ]);
  });

  it("upgrades a version 1 database and records every completed migration", async () => {
    const path = createVersion1Fixture({
      artists: ["Artist", "artist"],
      trackPlayCount: undefined,
    });
    await initDatabase(path);
    expect(readSchemaVersion()).to.equal(3);
    expect(readArtistsCaseInsensitively()).to.deep.equal(["Artist"]);
    expect(readTrackForeignKeys()).to.deep.equal([1]);
  });

  it("upgrades a version 2 database without losing library rows", async () => {
    const path = createVersion2Fixture({ file: "music/v2.mp3" });
    await initDatabase(path);
    expect(readSchemaVersion()).to.equal(3);
    expect(readTrack("music/v2.mp3")?.play_count).to.equal(0);
  });

  it("opens an existing version 3 database without changing user rows", async () => {
    const path = createVersion3Fixture({
      file: "music/keep.mp3",
      playCount: 17,
    });
    await initDatabase(path);
    expect(readTrack("music/keep.mp3")?.play_count).to.equal(17);
    expect(readSchemaVersion()).to.equal(3);
  });

  it("re-initializes an already migrated database without altering rows", async () => {
    const path = createVersion3Fixture({
      file: "music/keep.mp3",
      playCount: 17,
    });
    await initDatabase(path);
    await initDatabase(path);
    await closeDb();
    await initDatabase(path);
    expect(readSchemaVersion()).to.equal(3);
    expect(readTrack("music/keep.mp3")?.play_count).to.equal(17);
    expect(readArtistsCaseInsensitively()).to.deep.equal(["Artist"]);
  });

  it("enforces the schema contract for indexes, foreign keys, checks, and defaults", async () => {
    const path = temporaryDatabasePath();
    await initDatabase(path);
    const client = db().$client;

    // The six named performance indexes.
    const indexNames = new Set(
      (["tracks", "albums", "playlist_tracks"] as const).flatMap((table) =>
        (
          client.prepare(`PRAGMA index_list(${table})`).all() as {
            name: string;
          }[]
        ).map((entry) => entry.name),
      ),
    );
    expect([...indexNames]).to.include.members([
      "idx_tracks_artist",
      "idx_tracks_album",
      "idx_tracks_file",
      "idx_albums_artist",
      "idx_playlist_tracks_playlist",
      "idx_playlist_tracks_track",
    ]);

    // Foreign key delete actions.
    const foreignKeyActions = (table: string) =>
      (
        client.prepare(`PRAGMA foreign_key_list(${table})`).all() as {
          from: string;
          table: string;
          on_delete: string;
        }[]
      )
        .map((fk) => `${fk.from}->${fk.table}:${fk.on_delete}`)
        .sort();
    expect(foreignKeyActions("tracks")).to.deep.equal([
      "album_id->albums:SET NULL",
      "artist_id->artists:SET NULL",
    ]);
    expect(foreignKeyActions("albums")).to.deep.equal([
      "artist_id->artists:SET NULL",
    ]);
    expect(foreignKeyActions("playlist_tracks")).to.deep.equal([
      "playlist_id->playlists:CASCADE",
      "track_id->tracks:CASCADE",
    ]);

    // Table-level CHECK and UNIQUE constraints as written in sqlite_master.
    const tableSql = (name: string) => {
      const row = client
        .prepare(
          "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .get(name) as { sql: string } | undefined;
      if (row === undefined) throw new Error(`Table ${name} is missing`);
      return row.sql;
    };
    expect(tableSql("storage_sources")).to.include(
      "CHECK(type IN ('smb', 'nfs', 'local'))",
    );
    expect(tableSql("playlist_tracks")).to.include(
      "UNIQUE(playlist_id, track_id)",
    );

    // CURRENT_TIMESTAMP column defaults.
    const columnDefaults = (table: string) => {
      const entries = client.prepare(`PRAGMA table_info(${table})`).all() as {
        name: string;
        dflt_value: string | null;
      }[];
      return Object.fromEntries(
        entries.map((entry) => [entry.name, entry.dflt_value]),
      );
    };
    for (const table of [
      "artists",
      "albums",
      "tracks",
      "playlists",
      "storage_sources",
    ]) {
      const defaults = columnDefaults(table);
      expect(defaults.created_at, `${table}.created_at default`).to.equal(
        "CURRENT_TIMESTAMP",
      );
      expect(defaults.updated_at, `${table}.updated_at default`).to.equal(
        "CURRENT_TIMESTAMP",
      );
    }
    expect(columnDefaults("playlist_tracks").added_at).to.equal(
      "CURRENT_TIMESTAMP",
    );
    expect(columnDefaults("sync_metadata").updated_at).to.equal(
      "CURRENT_TIMESTAMP",
    );
  });

  it("drives drizzle query builders through the exported tables", async () => {
    const path = temporaryDatabasePath();
    await initDatabase(path);
    const { artists, tracks } = await import("@repo/db");

    db().insert(artists).values({ name: "Drizzle Probe" }).run();
    const artistRows = db().select().from(artists).all();
    const probeArtist: { id: number; name: string } | undefined = artistRows[0];
    expect(probeArtist?.name).to.equal("Drizzle Probe");

    db()
      .insert(tracks)
      .values({ file: "music/probe.mp3", title: "Probe Track" })
      .run();
    const updated = db()
      .update(tracks)
      .set({ play_count: 7 })
      .returning()
      .all();
    expect(updated).to.have.length(1);
    expect(updated[0]?.play_count).to.equal(7);
    expect(updated[0]?.file).to.equal("music/probe.mp3");
  });
});

function temporaryDatabasePath(): string {
  const directory = mkdtempSync(join(tmpdir(), "sonect-schema-"));
  directories.push(directory);
  return join(directory, "music.db");
}

function createVersion1Fixture(input: {
  artists: [string, string];
  trackPlayCount: undefined;
}): string {
  const path = temporaryDatabasePath();
  const client = new DatabaseSync(path);
  try {
    client.exec(`
      CREATE TABLE artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist_id INTEGER,
        artist_name TEXT,
        year INTEGER,
        date TEXT,
        genre TEXT,
        cover_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
      );
      CREATE TABLE tracks (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
      );
      CREATE TABLE schema_version (version INTEGER NOT NULL);
      INSERT INTO schema_version (version) VALUES (1);
    `);
    input.artists.forEach((name, position) => {
      client
        .prepare("INSERT INTO artists (id, name) VALUES (?, ?)")
        .run(position + 1, name);
    });
    client
      .prepare(
        "INSERT INTO albums (id, title, artist_id) VALUES (1, 'Version One Album', 2)",
      )
      .run();
    client
      .prepare(
        "INSERT INTO tracks (id, file, title, artist_id, album_id) VALUES (1, 'music/v1.mp3', 'Version One Track', 2, 1)",
      )
      .run();
  } finally {
    client.close();
  }
  return path;
}

function createVersion2Fixture(input: { file: string }): string {
  const path = temporaryDatabasePath();
  const client = new DatabaseSync(path);
  try {
    client.exec(`
      CREATE TABLE artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        artist_id INTEGER,
        artist_name TEXT,
        year INTEGER,
        date TEXT,
        genre TEXT,
        cover_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL
      );
      CREATE TABLE tracks (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL
      );
      CREATE TABLE schema_version (version INTEGER NOT NULL);
      INSERT INTO schema_version (version) VALUES (2);
    `);
    client.prepare("INSERT INTO artists (id, name) VALUES (1, 'Artist')").run();
    client
      .prepare(
        "INSERT INTO albums (id, title, artist_id) VALUES (1, 'Version Two Album', 1)",
      )
      .run();
    client
      .prepare(
        "INSERT INTO tracks (id, file, title, artist_id, album_id) VALUES (1, ?, 'Version Two Track', 1, 1)",
      )
      .run(input.file);
  } finally {
    client.close();
  }
  return path;
}

function createVersion3Fixture(input: {
  file: string;
  playCount: number;
}): string {
  const path = temporaryDatabasePath();
  const client = new DatabaseSync(path);
  try {
    client.exec(`
      CREATE TABLE artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_name TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE albums (
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
      CREATE TABLE tracks (
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
      CREATE TABLE schema_version (version INTEGER NOT NULL);
      INSERT INTO schema_version (version) VALUES (3);
    `);
    client.prepare("INSERT INTO artists (id, name) VALUES (1, 'Artist')").run();
    client
      .prepare(
        "INSERT INTO albums (id, title, artist_id) VALUES (1, 'Version Three Album', 1)",
      )
      .run();
    client
      .prepare(
        "INSERT INTO tracks (id, file, title, artist_id, album_id, play_count) VALUES (1, ?, 'Version Three Track', 1, 1, ?)",
      )
      .run(input.file, input.playCount);
  } finally {
    client.close();
  }
  return path;
}

function readSchemaVersion(): number {
  const row = db()
    .$client.prepare("SELECT MAX(version) AS version FROM schema_version")
    .get() as { version: number | null };
  if (row.version === null) {
    throw new Error("schema_version has no recorded version");
  }
  return row.version;
}

function readArtistsCaseInsensitively(): string[] {
  return (
    db()
      .$client.prepare(
        "SELECT name FROM artists GROUP BY LOWER(name) ORDER BY MIN(id)",
      )
      .all() as { name: string }[]
  ).map((row) => row.name);
}

function readTrackForeignKeys(): number[] {
  return (
    db().$client.prepare("SELECT artist_id FROM tracks ORDER BY id").all() as {
      artist_id: number | null;
    }[]
  )
    .map((row) => row.artist_id)
    .filter((artistId): artistId is number => artistId !== null);
}

function readTrack(file: string): { play_count: number } | undefined {
  return db()
    .$client.prepare("SELECT play_count FROM tracks WHERE file = ?")
    .get(file) as { play_count: number } | undefined;
}
