import { initDatabase, tracksDb, syncMetadataDb, db as _dbFn } from "@repo/db";
const db = () => _dbFn().$client;
import { MPDTrack } from "@repo/types";
import { mpdConnectionManager } from "./mpdConnectionManager";
import { parseMPDMessageToTracks } from "../utils/mpd.js";

export type SyncProgress = {
  current: number;
  total: number;
  phase?: "tracks" | "covers";
  track: {
    title: string;
    artist: string;
    album: string;
  } | null;
};

export class MpdSyncService {
  async initDatabase(): Promise<void> {
    await initDatabase();
  }

  async fetchAllTracksFromMPD(): Promise<MPDTrack[]> {
    const mpdTracks: MPDTrack[] = [];
    try {
      console.log("📀 Fetching albums...");
      const albumsRaw = await mpdConnectionManager.executeCommand("list", [
        "album",
      ]);
      const albums = albumsRaw
        .split("\n")
        .map((line) => line.replace("Album: ", "").trim())
        .filter((line) => line.trim() !== "");
      console.log(`   📀 Found ${albums.length} albums`);

      for (const album of albums) {
        try {
          const raw = await mpdConnectionManager.executeCommand("find", [
            "album",
            album,
          ]);
          const tracks = parseMPDMessageToTracks(raw);
          console.log(`      🎵 Album "${album}" has ${tracks.length} tracks`);
          mpdTracks.push(...tracks);
        } catch (err) {
          console.error(
            `         ❌ Error fetching tracks for album "${album}":`,
            err,
          );
        }
      }

      return mpdTracks;
    } catch (error) {
      console.error("❌ Error fetching tracks from MPD:", error);
      throw error;
    }
  }

  async syncAll(onProgress?: (progress: SyncProgress) => void): Promise<void> {
    try {
      console.log("🔄 Starting full sync from MPD...");

      const playbackStats = new Map(
        (
          db()
            .prepare("SELECT file, play_count, last_played FROM tracks")
            .all() as {
            file: string;
            play_count: number | null;
            last_played: string | null;
          }[]
        ).map((track) => [track.file, track]),
      );

      console.log("   🗑️  Clearing existing database...");
      db().exec("DELETE FROM tracks");
      db().exec("DELETE FROM albums");
      db().exec("DELETE FROM artists");

      const mpdTracks = await this.fetchAllTracksFromMPD();

      const seen = new Set<string>();
      const uniqueTracks = mpdTracks.filter((t) => {
        const key =
          `${t.artist ?? ""}|${t.album ?? ""}|${t.title ?? ""}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      console.log(
        `📀 Found ${mpdTracks.length} tracks (${uniqueTracks.length} unique) in MPD library`,
      );

      let synced = 0;
      let errors = 0;
      const restorePlaybackStats = db().prepare(
        "UPDATE tracks SET play_count = ?, last_played = ? WHERE id = ?",
      );

      for (const track of uniqueTracks) {
        try {
          const trackId = tracksDb.upsert(track);
          const previousStats = playbackStats.get(track.file);
          if (previousStats) {
            restorePlaybackStats.run(
              previousStats.play_count ?? 0,
              previousStats.last_played,
              trackId,
            );
          }
          synced++;

          onProgress?.({
            current: synced,
            total: uniqueTracks.length,
            phase: "tracks",
            track: {
              title: track.title ?? "",
              artist: track.artist ?? "",
              album: track.album ?? "",
            },
          });

          if (synced % 100 === 0) {
            console.log(
              `   📊 Synced ${synced}/${uniqueTracks.length} tracks...`,
            );
          }
        } catch (err) {
          errors++;
          console.error(`   ❌ Error syncing track ${track.file}:`, err);
        }
      }

      onProgress?.({
        current: uniqueTracks.length,
        total: uniqueTracks.length,
        phase: "tracks",
        track: null,
      });

      syncMetadataDb.setLastSync();

      console.log(`✅ Sync completed!`);
      console.log(
        `   📊 Successfully synced: ${synced}/${uniqueTracks.length} unique tracks`,
      );
      if (errors > 0) {
        console.log(`   ⚠️  Errors: ${errors} tracks`);
      }
      console.log(`   ⏰ Last sync: ${syncMetadataDb.getLastSync()}`);
    } catch (error) {
      console.error("❌ Sync failed:", error);
      throw error;
    }
  }

  async getStats(): Promise<{
    totalTracks: number;
    lastSync?: Date;
  }> {
    const tracks = tracksDb.getAll();
    return {
      totalTracks: tracks.length,
      lastSync: syncMetadataDb.getLastSync(),
    };
  }

  async clearAll(): Promise<void> {
    console.log("⚠️  Clearing all database data...");
    db().exec("DELETE FROM tracks");
    db().exec("DELETE FROM albums");
    db().exec("DELETE FROM artists");
    db().exec("DELETE FROM sync_metadata");
    console.log("✅ Database cleared");
  }
}

export default MpdSyncService;
