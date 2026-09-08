import { afterEach, beforeEach, describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { closeDb, db, initDatabase } from "@repo/db";

const directories: string[] = [];

describe("database drizzle migrations", () => {
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

  it("applies migration 0000 to a brand-new database", async () => {
    const path = temporaryDatabasePath();
    await initDatabase(path);
    const applied = db()
      .$client.prepare("SELECT COUNT(*) AS n FROM __drizzle_migrations")
      .get() as { n: number };
    // 0000 (initial schema) + 0001 (drop unused artist/album/track columns).
    expect(applied.n).to.equal(2);
  });

  it("re-running initDatabase is a no-op and preserves rows", async () => {
    const path = temporaryDatabasePath();
    await initDatabase(path);
    db().$client.prepare("INSERT INTO artists (name) VALUES ('Keep')").run();
    await closeDb();
    await initDatabase(path);
    const rows = db().$client.prepare("SELECT name FROM artists").all() as {
      name: string;
    }[];
    expect(rows.map((row) => row.name)).to.deep.equal(["Keep"]);
    const applied = db()
      .$client.prepare("SELECT COUNT(*) AS n FROM __drizzle_migrations")
      .get() as { n: number };
    expect(applied.n).to.equal(2);
  });

  it("wipes a legacy schema_version database and rebuilds as v1", async () => {
    const path = createLegacyFixture();
    await initDatabase(path);
    const legacyGone = db()
      .$client.prepare(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE name = 'schema_version'",
      )
      .get() as { n: number };
    expect(legacyGone.n).to.equal(0);
    const rows = db().$client.prepare("SELECT name FROM artists").all() as {
      name: string;
    }[];
    expect(rows).to.deep.equal([]);
    expect(hasTable("__drizzle_migrations")).to.be.true;
    const applied = db()
      .$client.prepare("SELECT COUNT(*) AS n FROM __drizzle_migrations")
      .get() as { n: number };
    expect(applied.n).to.equal(2);
  });

  it("enforces the schema contract for tables, indexes, foreign keys, checks, and defaults", async () => {
    const path = temporaryDatabasePath();
    await initDatabase(path);
    const client = db().$client;

    // The migrator's schema: the eight application tables plus the
    // migrator's own bookkeeping table, and nothing else (internal
    // sqlite_* bookkeeping like sqlite_sequence is excluded).
    const tableNames = (
      client
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as { name: string }[]
    )
      .map((row) => row.name)
      .filter((name) => !name.startsWith("sqlite_"));
    expect([...tableNames].sort()).to.deep.equal([
      "__drizzle_migrations",
      "albums",
      "artists",
      "playlist_tracks",
      "playlists",
      "setup_progress",
      "storage_sources",
      "sync_metadata",
      "tracks",
    ]);
    expect(tableNames).to.not.include("schema_version");

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
      `CHECK("type" in ('smb', 'nfs', 'local'))`,
    );
    expect(tableSql("playlist_tracks")).to.include(
      "UNIQUE(`playlist_id`,`track_id`)",
    );
    expect(tableSql("tracks")).to.include("`tracks_file_unique`");

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

// Enough of the retired schema_version chain (artists + schema_version with a
// row) to trip initDatabase()'s legacy wipe: it has our tables but no
// __drizzle_migrations bookkeeping.
function createLegacyFixture(): string {
  const path = temporaryDatabasePath();
  const client = new DatabaseSync(path);
  try {
    client.exec(`
      CREATE TABLE artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE schema_version (version INTEGER NOT NULL);
      INSERT INTO schema_version (version) VALUES (3);
    `);
    client.prepare("INSERT INTO artists (name) VALUES ('Legacy')").run();
  } finally {
    client.close();
  }
  return path;
}

function hasTable(name: string): boolean {
  return (
    db()
      .$client.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(name) !== undefined
  );
}
