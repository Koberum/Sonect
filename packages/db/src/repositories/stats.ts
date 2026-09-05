import { sql } from "drizzle-orm";
import { db } from "../connection.js";
import { syncMetadataDb } from "./syncMetadata.js";

// Raw node:sqlite row for the one-shot dashboard aggregate. The year columns
// come back as TEXT (or NULL) and are parsed below.
type StatsRow = {
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

export type LibraryStats = {
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
};

export const statsDb = {
  getStats(): LibraryStats {
    // Every dashboard counter in a single SELECT so the library page costs
    // one round trip; keys match the previous raw-SQL shape exactly.
    const counts = db().get<StatsRow>(sql`
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
    `);

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
