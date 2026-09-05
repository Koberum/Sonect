import { DBTrack, DBPlaylist, DBStorageSource } from "@repo/types";
import { sqlite as _sqlDb } from "./connection.js";
const db = () => _sqlDb();

// Statistics operations
export const statsDb = {
  getStats(): {
    totalTracks: number;
    totalArtists: number;
    totalAlbums: number;
    totalPlaylists: number;
    totalGenres: number;
    totalDuration: number;
    averageDuration: number;
    earliestYear: number | null;
    latestYear: number | null;
    tracksWithoutAlbum: number;
    lastSync: string | null;
  } {
    const counts = db()
      .prepare(
        `
      SELECT
        (SELECT COUNT(*) FROM tracks) AS totalTracks,
        (SELECT COUNT(*) FROM artists) AS totalArtists,
        (SELECT COUNT(*) FROM albums) AS totalAlbums,
        (SELECT COUNT(*) FROM playlists) AS totalPlaylists,
        (SELECT COUNT(DISTINCT genre) FROM tracks WHERE genre IS NOT NULL AND genre != '') AS totalGenres,
        (SELECT COALESCE(SUM(duration), 0) FROM tracks) AS totalDuration,
        (SELECT COALESCE(AVG(duration), 0) FROM tracks) AS averageDuration,
        (SELECT MIN(date) FROM tracks WHERE date IS NOT NULL AND date != '') AS earliestYear,
        (SELECT MAX(date) FROM tracks WHERE date IS NOT NULL AND date != '') AS latestYear,
        (SELECT COUNT(*) FROM tracks WHERE album_id IS NULL) AS tracksWithoutAlbum
    `,
      )
      .get() as {
      totalTracks: number;
      totalArtists: number;
      totalAlbums: number;
      totalPlaylists: number;
      totalGenres: number;
      totalDuration: number;
      averageDuration: number;
      earliestYear: string | null;
      latestYear: string | null;
      tracksWithoutAlbum: number;
    };

    const lastSync = syncMetadataDb.get("last_sync") ?? null;
    const earliestYear = counts.earliestYear
      ? parseInt(counts.earliestYear, 10)
      : null;
    const latestYear = counts.latestYear
      ? parseInt(counts.latestYear, 10)
      : null;

    return {
      totalTracks: counts.totalTracks,
      totalArtists: counts.totalArtists,
      totalAlbums: counts.totalAlbums,
      totalPlaylists: counts.totalPlaylists,
      totalGenres: counts.totalGenres,
      totalDuration: counts.totalDuration,
      averageDuration: counts.averageDuration,
      earliestYear,
      latestYear,
      tracksWithoutAlbum: counts.tracksWithoutAlbum,
      lastSync,
    };
  },
};

// Playlist operations
export const playlistsDb = {
  getAll(): DBPlaylist[] {
    return db()
      .prepare("SELECT * FROM playlists ORDER BY name")
      .all() as DBPlaylist[];
  },

  getById(id: number): DBPlaylist | undefined {
    return db().prepare("SELECT * FROM playlists WHERE id = ?").get(id) as
      DBPlaylist | undefined;
  },

  create(name: string, description?: string): number {
    const result = db()
      .prepare("INSERT INTO playlists (name, description) VALUES (?, ?)")
      .run(name, description || null);
    return result.lastInsertRowid as number;
  },

  update(id: number, data: { name?: string; description?: string }): void {
    const fields: string[] = [];
    const values: (number | string)[] = [];
    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push("description = ?");
      values.push(data.description);
    }
    if (fields.length === 0) return;
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);
    db()
      .prepare(`UPDATE playlists SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
  },

  delete(id: number): void {
    db().prepare("DELETE FROM playlist_tracks WHERE playlist_id = ?").run(id);
    db().prepare("DELETE FROM playlists WHERE id = ?").run(id);
  },

  addTrack(playlistId: number, trackId: number): void {
    const maxPos = db()
      .prepare(
        "SELECT COALESCE(MAX(position), -1) as maxPos FROM playlist_tracks WHERE playlist_id = ?",
      )
      .get(playlistId) as { maxPos: number };
    db()
      .prepare(
        "INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position) VALUES (?, ?, ?)",
      )
      .run(playlistId, trackId, maxPos.maxPos + 1);
  },

  removeTrack(playlistTrackId: number): void {
    db()
      .prepare("DELETE FROM playlist_tracks WHERE id = ?")
      .run(playlistTrackId);
  },

  getTracks(
    playlistId: number,
  ): (DBTrack & { pt_id: number; position: number; added_at?: string })[] {
    return db()
      .prepare(
        `
      SELECT t.*, pt.id as pt_id, pt.position, pt.added_at
      FROM playlist_tracks pt
      JOIN tracks t ON pt.track_id = t.id
      WHERE pt.playlist_id = ?
      ORDER BY pt.position
    `,
      )
      .all(playlistId) as any;
  },
};

// Sync metadata operations
export const syncMetadataDb = {
  set(key: string, value: string): void {
    db()
      .prepare(
        `
      INSERT INTO sync_metadata (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `,
      )
      .run(key, value, value);
  },

  get(key: string): string | undefined {
    const result = db()
      .prepare("SELECT value FROM sync_metadata WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return result?.value;
  },

  getLastSync(): Date | undefined {
    const result = syncMetadataDb.get("last_sync");
    return result ? new Date(result) : undefined;
  },

  setLastSync(): void {
    syncMetadataDb.set("last_sync", new Date().toISOString());
  },
};

// Storage source operations
export const storageDb = {
  getAll(): DBStorageSource[] {
    return db()
      .prepare("SELECT * FROM storage_sources ORDER BY name")
      .all() as DBStorageSource[];
  },

  getById(id: number): DBStorageSource | undefined {
    return db()
      .prepare("SELECT * FROM storage_sources WHERE id = ?")
      .get(id) as DBStorageSource | undefined;
  },

  create(data: {
    name: string;
    type: "smb" | "nfs" | "local";
    uri: string;
    mount_path: string;
    username?: string;
    password?: string;
    enabled?: boolean;
  }): number {
    const result = db()
      .prepare(
        "INSERT INTO storage_sources (name, type, uri, mount_path, username, password, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        data.name,
        data.type,
        data.uri,
        data.mount_path,
        data.username ?? null,
        data.password ?? null,
        data.enabled ? 1 : 0,
      );
    return result.lastInsertRowid as number;
  },

  update(
    id: number,
    data: {
      name?: string;
      type?: "smb" | "nfs" | "local";
      uri?: string;
      mount_path?: string;
      username?: string;
      password?: string;
      enabled?: boolean;
    },
  ): void {
    const fields: string[] = [];
    const values: (number | string)[] = [];
    if (data.name !== undefined) {
      fields.push("name = ?");
      values.push(data.name);
    }
    if (data.type !== undefined) {
      fields.push("type = ?");
      values.push(data.type);
    }
    if (data.uri !== undefined) {
      fields.push("uri = ?");
      values.push(data.uri);
    }
    if (data.mount_path !== undefined) {
      fields.push("mount_path = ?");
      values.push(data.mount_path);
    }
    if (data.username !== undefined) {
      fields.push("username = ?");
      values.push(data.username);
    }
    if (data.password !== undefined) {
      fields.push("password = ?");
      values.push(data.password);
    }
    if (data.enabled !== undefined) {
      fields.push("enabled = ?");
      values.push(data.enabled ? 1 : 0);
    }
    if (fields.length === 0) return;
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);
    db()
      .prepare(`UPDATE storage_sources SET ${fields.join(", ")} WHERE id = ?`)
      .run(...values);
  },

  delete(id: number): void {
    db().prepare("DELETE FROM storage_sources WHERE id = ?").run(id);
  },

  updateStats(
    id: number,
    stats: { file_count: number; dir_count: number; total_size: number },
  ): void {
    db()
      .prepare(
        "UPDATE storage_sources SET file_count = ?, dir_count = ?, total_size = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      )
      .run(stats.file_count, stats.dir_count, stats.total_size, id);
  },
};

// Setup progress operations
export const setupDb = {
  getAll(): { step: string; completed: boolean; completed_at?: string }[] {
    const rows = db()
      .prepare("SELECT * FROM setup_progress ORDER BY id")
      .all() as { step: string; completed: number; completed_at?: string }[];
    return rows.map((r) => ({ ...r, completed: r.completed === 1 }));
  },

  get(
    step: string,
  ): { step: string; completed: boolean; completed_at?: string } | undefined {
    const row = db()
      .prepare("SELECT * FROM setup_progress WHERE step = ?")
      .get(step) as
      { step: string; completed: number; completed_at?: string } | undefined;
    if (!row) return undefined;
    return { ...row, completed: row.completed === 1 };
  },

  setCompleted(step: string): void {
    db()
      .prepare(
        `INSERT INTO setup_progress (step, completed, completed_at)
       VALUES (?, 1, CURRENT_TIMESTAMP)
       ON CONFLICT(step) DO UPDATE SET completed = 1, completed_at = CURRENT_TIMESTAMP`,
      )
      .run(step);
  },

  setIncomplete(step: string): void {
    db()
      .prepare(
        "UPDATE setup_progress SET completed = 0, completed_at = NULL WHERE step = ?",
      )
      .run(step);
  },
};
