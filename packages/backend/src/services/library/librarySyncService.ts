import {
  initDatabase,
  tracksDb,
  syncMetadataDb,
  librarySyncDb,
} from "@repo/db";
import { MPDTrack } from "@repo/types";
import { mpdConnectionManager } from "@services/mpd/mpdConnectionManager";
import { parseMPDMessageToTracks } from "../../utils/mpd.js";

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

export class LibrarySyncService {
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

      // Fetch and deduplicate before any destructive database work: a failed
      // fetch must leave the existing library untouched.
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

      const result = librarySyncDb.rebuild(uniqueTracks, (completed, track) => {
        onProgress?.({
          current: completed,
          total: uniqueTracks.length,
          phase: "tracks",
          track: {
            title: track.title ?? "",
            artist: track.artist ?? "",
            album: track.album ?? "",
          },
        });

        if (completed % 100 === 0) {
          console.log(
            `   📊 Synced ${completed}/${uniqueTracks.length} tracks...`,
          );
        }
      });

      onProgress?.({
        current: uniqueTracks.length,
        total: uniqueTracks.length,
        phase: "tracks",
        track: null,
      });

      console.log(`✅ Sync completed!`);
      console.log(
        `   📊 Successfully synced: ${result.synced}/${uniqueTracks.length} unique tracks`,
      );
      if (result.errors > 0) {
        console.log(`   ⚠️  Errors: ${result.errors} tracks`);
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
    librarySyncDb.clearAll();
    console.log("✅ Database cleared");
  }
}

export const librarySyncService = new LibrarySyncService();
