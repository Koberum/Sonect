import type { MPDTrack } from "@repo/types";
import { sqlite as _sqlDb } from "./connection.js";
const db = () => _sqlDb();
import {
  DBAlbum,
  DBArtist,
  DBTrack,
  DBPlaylist,
  DBStorageSource,
} from "@repo/types";

// Artist operations
export const artistsDb = {
  findOrCreate(name: string): number {
    const existing = db()
      .prepare("SELECT id FROM artists WHERE name = ? COLLATE NOCASE")
      .get(name) as { id: number } | undefined;
    if (existing) return existing.id;

    const result = db()
      .prepare("INSERT INTO artists (name) VALUES (?)")
      .run(name);
    return result.lastInsertRowid as number;
  },

  getAll({
    limit,
    offset,
  }: { limit?: number; offset?: number } = {}): DBArtist[] {
    let query = "SELECT * FROM artists ORDER BY name";
    const params: (number | string)[] = [];
    if (limit !== undefined) {
      query += " LIMIT ?";
      params.push(limit);
      if (offset !== undefined) {
        query += " OFFSET ?";
        params.push(offset);
      }
    }
    return db()
      .prepare(query)
      .all(...params) as DBArtist[];
  },

  count(): number {
    return (
      db().prepare("SELECT COUNT(*) as count FROM artists").get() as {
        count: number;
      }
    ).count;
  },

  getById(id: number): DBArtist | undefined {
    return db().prepare("SELECT * FROM artists WHERE id = ?").get(id) as
      DBArtist | undefined;
  },

  search(query: string, limit = 20): DBArtist[] {
    const pattern = `%${query}%`;
    return db()
      .prepare("SELECT * FROM artists WHERE name LIKE ? ORDER BY name LIMIT ?")
      .all(pattern, limit) as DBArtist[];
  },
};

// Album operations
export const albumsDb = {
  findOrCreate(
    title: string,
    artistId?: number,
    year?: number,
    genre?: string,
  ): number {
    const existing = db()
      .prepare(
        "SELECT id, artist_id FROM albums WHERE title = ? COLLATE NOCASE LIMIT 1",
      )
      .get(title) as { id: number; artist_id: number | null } | undefined;

    if (existing) {
      if (artistId && existing.artist_id !== artistId) {
        db()
          .prepare("UPDATE albums SET artist_id = ? WHERE id = ?")
          .run(artistId, existing.id);
      }
      if (genre) {
        db()
          .prepare("UPDATE albums SET genre = ? WHERE id = ? AND genre IS NULL")
          .run(genre, existing.id);
      }
      return existing.id;
    }

    const result = db()
      .prepare(
        "INSERT INTO albums (title, artist_id, year, genre) VALUES (?, ?, ?, ?)",
      )
      .run(title, artistId ?? null, year ?? null, genre ?? null);

    return result.lastInsertRowid as number;
  },

  getAll({
    sort,
    limit,
    offset,
  }: { sort?: string; limit?: number; offset?: number } = {}): DBAlbum[] {
    let orderBy = "title";
    if (sort === "year") orderBy = "year DESC, title";
    if (sort === "recent") orderBy = "created_at DESC";
    let query = `SELECT * FROM albums ORDER BY ${orderBy}`;
    const params: (number | string)[] = [];
    if (limit !== undefined) {
      query += " LIMIT ?";
      params.push(limit);
      if (offset !== undefined) {
        query += " OFFSET ?";
        params.push(offset);
      }
    }
    return db()
      .prepare(query)
      .all(...params) as DBAlbum[];
  },

  count(): number {
    return (
      db().prepare("SELECT COUNT(*) as count FROM albums").get() as {
        count: number;
      }
    ).count;
  },

  getRecent(limit: number): DBAlbum[] {
    return db()
      .prepare("SELECT * FROM albums ORDER BY created_at DESC LIMIT ?")
      .all(limit) as DBAlbum[];
  },

  getById(id: number): DBAlbum | undefined {
    return db().prepare("SELECT * FROM albums WHERE id = ?").get(id) as
      DBAlbum | undefined;
  },

  getByGenre(genre: string): DBAlbum[] {
    return db()
      .prepare("SELECT * FROM albums WHERE genre = ? ORDER BY title")
      .all(genre) as DBAlbum[];
  },

  getByArtist(artistId: number): DBAlbum[] {
    return db()
      .prepare("SELECT * FROM albums WHERE artist_id = ? ORDER BY year, title")
      .all(artistId) as DBAlbum[];
  },

  getRankedByPlayCount({
    artistId,
    genre,
  }: {
    artistId?: number;
    genre?: string;
  } = {}): DBAlbum[] {
    const conditions: string[] = [];
    const params: (number | string)[] = [];

    if (artistId !== undefined) {
      conditions.push("al.artist_id = ?");
      params.push(artistId);
    }
    if (genre !== undefined) {
      conditions.push("al.genre = ?");
      params.push(genre);
    }
    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return db()
      .prepare(
        `SELECT al.*
         FROM albums al
         LEFT JOIN tracks t ON t.album_id = al.id
         ${where}
         GROUP BY al.id
         ORDER BY COALESCE(SUM(t.play_count), 0) DESC,
                  al.title COLLATE NOCASE ASC,
                  al.id ASC`,
      )
      .all(...params) as DBAlbum[];
  },

  search(query: string, limit = 20): DBAlbum[] {
    const pattern = `%${query}%`;
    return db()
      .prepare(
        `SELECT DISTINCT al.* FROM albums al
       LEFT JOIN artists a ON al.artist_id = a.id
       WHERE al.title LIKE ? OR a.name LIKE ?
       ORDER BY al.title
       LIMIT ?`,
      )
      .all(pattern, pattern, limit) as DBAlbum[];
  },

  getCoverPreviews(artistId: number, limit: number): string[] {
    return (
      db()
        .prepare(
          "SELECT cover_path FROM albums WHERE artist_id = ? AND cover_path IS NOT NULL AND cover_path != '' LIMIT ?",
        )
        .all(artistId, limit) as { cover_path: string }[]
    ).map((r) => r.cover_path);
  },

  getByTitleAndArtist(title: string, artistName: string): DBAlbum | undefined {
    return db()
      .prepare(
        `
      SELECT al.* FROM albums al
      JOIN artists ar ON al.artist_id = ar.id
      WHERE al.title = ? AND ar.name COLLATE NOCASE = ?
      LIMIT 1
    `,
      )
      .get(title, artistName) as DBAlbum | undefined;
  },

  // Update cover path for an album
  updateCoverPath(albumId: number, coverPath: string): void {
    db()
      .prepare("UPDATE albums SET cover_path = ? WHERE id = ?")
      .run(coverPath, albumId);
  },

  updateLastPlayed(albumId: number): void {
    db()
      .prepare("UPDATE albums SET last_played = datetime('now') WHERE id = ?")
      .run(albumId);
  },

  getRecentAlbums(limit: number, excludeAlbumId?: number): DBAlbum[] {
    if (excludeAlbumId !== undefined) {
      return db()
        .prepare(
          "SELECT * FROM albums WHERE id != ? AND last_played IS NOT NULL ORDER BY last_played DESC LIMIT ?",
        )
        .all(excludeAlbumId, limit) as DBAlbum[];
    }
    return db()
      .prepare(
        "SELECT * FROM albums WHERE last_played IS NOT NULL ORDER BY last_played DESC LIMIT ?",
      )
      .all(limit) as DBAlbum[];
  },
};

// Track operations
export const tracksDb = {
  incrementPlayCount(trackId: number): void {
    db()
      .prepare(
        "UPDATE tracks SET play_count = play_count + 1, last_played = datetime('now') WHERE id = ?",
      )
      .run(trackId);
  },

  getTopTracks(
    limit: number,
    offset = 0,
  ): (DBTrack & { artist_name?: string; album_title?: string })[] {
    return db()
      .prepare(
        `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_path as cover_path
         FROM tracks t
         JOIN artists a ON t.artist_id = a.id
         JOIN albums al ON t.album_id = al.id
         ORDER BY t.play_count DESC, t.last_played DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset) as any;
  },

  getRecentlyPlayed(
    limit: number,
  ): (DBTrack & { artist_name?: string; album_title?: string })[] {
    return db()
      .prepare(
        `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_path as cover_path
         FROM tracks t
         JOIN artists a ON t.artist_id = a.id
         JOIN albums al ON t.album_id = al.id
         WHERE t.last_played IS NOT NULL
         ORDER BY t.last_played DESC
         LIMIT ?`,
      )
      .all(limit) as any;
  },

  getTracksForDiscovery(
    genres: string[],
    artistIds: number[],
    limit: number,
  ): (DBTrack & { artist_name?: string; album_title?: string })[] {
    const genrePlaceholders = genres.map(() => "?").join(",");
    const artistPlaceholders = artistIds.map(() => "?").join(",");
    return db()
      .prepare(
        `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_path as cover_path
         FROM tracks t
         JOIN artists a ON t.artist_id = a.id
         JOIN albums al ON t.album_id = al.id
         WHERE (t.genre IN (${genrePlaceholders}) OR t.artist_id IN (${artistPlaceholders}))
           AND (t.play_count IS NULL OR t.play_count < 3)
         ORDER BY RANDOM()
         LIMIT ?`,
      )
      .all(...genres, ...artistIds, limit) as any;
  },

  getTopGenres(limit: number): string[] {
    const rows = db()
      .prepare(
        `SELECT genre, SUM(play_count) as total
         FROM tracks
         WHERE genre IS NOT NULL AND genre != ''
         GROUP BY genre
         ORDER BY total DESC
         LIMIT ?`,
      )
      .all(limit) as { genre: string; total: number }[];
    return rows.map((r) => r.genre);
  },

  getTopArtists(limit: number): { id: number; name: string; total: number }[] {
    return db()
      .prepare(
        `SELECT a.id, a.name, COALESCE(SUM(t.play_count), 0) as total
         FROM artists a
         JOIN tracks t ON t.artist_id = a.id
         GROUP BY a.id
         ORDER BY total DESC
         LIMIT ?`,
      )
      .all(limit) as any;
  },

  getTopGenre(): string | null {
    const row = db()
      .prepare(
        `SELECT genre, SUM(play_count) as total
         FROM tracks
         WHERE genre IS NOT NULL AND genre != ''
         GROUP BY genre
         ORDER BY total DESC
         LIMIT 1`,
      )
      .get() as { genre: string } | undefined;
    return row?.genre || null;
  },

  getTracksByGenre(
    genre: string,
    limit: number,
  ): (DBTrack & { artist_name?: string; album_title?: string })[] {
    return db()
      .prepare(
        `SELECT t.*, a.name as artist_name, al.title as album_title, al.cover_path as cover_path
         FROM tracks t
         JOIN artists a ON t.artist_id = a.id
         JOIN albums al ON t.album_id = al.id
         WHERE t.genre = ?
         ORDER BY t.play_count DESC
         LIMIT ?`,
      )
      .all(genre, limit) as any;
  },
  upsert(track: MPDTrack): number {
    const artistId = track.artist
      ? artistsDb.findOrCreate(track.artist)
      : undefined;
    const albumArtistId = track.albumArtist
      ? artistsDb.findOrCreate(track.albumArtist)
      : undefined;
    const albumId = track.album
      ? albumsDb.findOrCreate(
          track.album,
          albumArtistId ?? artistId,
          track.date ? parseInt(track.date.split("-")[0]) : undefined,
          track.genre,
        )
      : undefined;

    const existing = db()
      .prepare("SELECT id FROM tracks WHERE file = ?")
      .get(track.file) as { id: number } | undefined;

    if (existing) {
      db()
        .prepare(
          `
        UPDATE tracks SET
          title = ?,
          artist_id = ?,
          album_id = ?,
          track_number = ?,
          disc_number = ?,
          duration = ?,
          date = ?,
          genre = ?,
          composer = ?,
          performer = ?,
          last_modified = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
        )
        .run(
          track.title || "Unknown",
          artistId ?? null,
          albumId ?? null,
          track.track ? parseInt(track.track.toString().split("/")[0]) : null,
          track.disc ? parseInt(track.disc.toString()) : null,
          track.duration ?? null,
          track.date ?? null,
          track.genre ?? null,
          track.composer ?? null,
          track.performer ?? null,
          track.lastModified ?? null,
          existing.id,
        );
      return existing.id;
    } else {
      const result = db()
        .prepare(
          `
        INSERT INTO tracks (
          file, title, artist_id, album_id, track_number, disc_number,
          duration, date, genre, composer, performer, last_modified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .run(
          track.file,
          track.title || "Unknown",
          artistId ?? null,
          albumId ?? null,
          track.track ? parseInt(track.track.toString().split("/")[0]) : null,
          track.disc ? parseInt(track.disc.toString()) : null,
          track.duration ?? null,
          track.date ?? null,
          track.genre ?? null,
          track.composer ?? null,
          track.performer ?? null,
          track.lastModified ?? null,
        );
      return result.lastInsertRowid as number;
    }
  },

  getAll({
    sort,
    limit,
    offset,
  }: { sort?: string; limit?: number; offset?: number } = {}): DBTrack[] {
    let orderBy = "title";
    if (sort === "recent") orderBy = "created_at DESC";
    if (sort === "duration") orderBy = "duration DESC";
    let query = `SELECT * FROM tracks ORDER BY ${orderBy}`;
    const params: (number | string)[] = [];
    if (limit !== undefined) {
      query += " LIMIT ?";
      params.push(limit);
      if (offset !== undefined) {
        query += " OFFSET ?";
        params.push(offset);
      }
    }
    return db()
      .prepare(query)
      .all(...params) as DBTrack[];
  },

  count(): number {
    return (
      db().prepare("SELECT COUNT(*) as count FROM tracks").get() as {
        count: number;
      }
    ).count;
  },

  getRecent(limit: number): DBTrack[] {
    return db()
      .prepare("SELECT * FROM tracks ORDER BY created_at DESC LIMIT ?")
      .all(limit) as DBTrack[];
  },

  getGenres(): { genre: string; track_count: number; album_count: number }[] {
    return db()
      .prepare(
        `
      SELECT
        t.genre,
        COUNT(t.id) AS track_count,
        COUNT(DISTINCT t.album_id) AS album_count
      FROM tracks t
      WHERE t.genre IS NOT NULL AND t.genre != ''
      GROUP BY t.genre
      ORDER BY t.genre
    `,
      )
      .all() as { genre: string; track_count: number; album_count: number }[];
  },

  getByGenre(genre: string): DBTrack[] {
    return db()
      .prepare("SELECT * FROM tracks WHERE genre = ? ORDER BY title")
      .all(genre) as DBTrack[];
  },

  getById(id: number): DBTrack | undefined {
    return db().prepare("SELECT * FROM tracks WHERE id = ?").get(id) as
      DBTrack | undefined;
  },

  getByArtist(artistId: number): DBTrack[] {
    return db()
      .prepare("SELECT * FROM tracks WHERE artist_id = ? ORDER BY title")
      .all(artistId) as DBTrack[];
  },

  getByAlbum(albumId: number): DBTrack[] {
    return db()
      .prepare(
        "SELECT * FROM tracks WHERE album_id = ? ORDER BY disc_number, track_number, title",
      )
      .all(albumId) as DBTrack[];
  },

  getByAlbumOrdered(albumId: number): DBTrack[] {
    return db()
      .prepare(
        "SELECT * FROM tracks WHERE album_id = ? ORDER BY disc_number, track_number",
      )
      .all(albumId) as DBTrack[];
  },

  getByFile(file: string): DBTrack | undefined {
    return db().prepare("SELECT * FROM tracks WHERE file = ?").get(file) as
      DBTrack | undefined;
  },

  getRandomTracks(limit: number, excludeFiles?: string[]): DBTrack[] {
    if (excludeFiles && excludeFiles.length > 0) {
      const placeholders = excludeFiles.map(() => "?").join(",");
      return db()
        .prepare(
          `SELECT * FROM tracks WHERE file NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT ?`,
        )
        .all(...excludeFiles, limit) as DBTrack[];
    }
    return db()
      .prepare("SELECT * FROM tracks ORDER BY RANDOM() LIMIT ?")
      .all(limit) as DBTrack[];
  },

  getByArtistAlbumTitle(
    artist: string,
    album: string,
    title: string,
  ): DBTrack | undefined {
    return db()
      .prepare(
        `
      SELECT t.* FROM tracks t
      LEFT JOIN artists a ON t.artist_id = a.id
      LEFT JOIN albums al ON t.album_id = al.id
      WHERE a.name COLLATE NOCASE = ? AND al.title = ? AND t.title = ?
      LIMIT 1
    `,
      )
      .get(artist, album, title) as DBTrack | undefined;
  },

  deleteByFile(file: string): void {
    db().prepare("DELETE FROM tracks WHERE file = ?").run(file);
  },

  search(query: string): DBTrack[] {
    const searchPattern = `%${query}%`;
    return db()
      .prepare(
        `
      SELECT t.* FROM tracks t
      LEFT JOIN artists a ON t.artist_id = a.id
      LEFT JOIN albums al ON t.album_id = al.id
      WHERE t.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?
      ORDER BY t.title
      LIMIT 100
    `,
      )
      .all(searchPattern, searchPattern, searchPattern) as DBTrack[];
  },
};

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
