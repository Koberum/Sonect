import {
  initDatabase,
  tracksDb,
  syncMetadataDb,
  librarySyncDb,
} from "@repo/db";
import { MPDTrack } from "@repo/types";
import { MpdConnectionManager } from "@services/mpd/mpdConnectionManager";
import type { LogService } from "@services/utils/logService";
import { parseKeyValue, parseMPDMessageToTracks } from "../../utils/mpd.js";
import { readNewMpdLogLines, parseMpdLogLines } from "../mpd/mpdLogReader.js";
import { broadcast } from "../../ws/broadcast.js";
import path from "path";

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
  constructor(
    private readonly mpdConnectionManager: MpdConnectionManager,
    private readonly logService: LogService,
  ) {}

  async updateLibrary(): Promise<void> {
    const cmdClient = this.mpdConnectionManager.getCmdClient();
    if (!cmdClient) throw new Error("MPD cmd client not connected");

    let fileCount = 0;

    this.logService.pushLog("info", "Starting MPD library update");
    await this.mpdConnectionManager.executeCommand("update");

    await new Promise((r) => setTimeout(r, 500));

    const raw = await this.mpdConnectionManager.executeCommand("status");
    const status = parseKeyValue(raw);

    if (status.updating_db) {
      const added = readNewMpdLogLines(0);
      let logPos = added.newPosition;
      // Broadcast files from first chunk if any (fix first-chunk dropped bug)
      if (added.lines.length > 0) {
        const firstParsed = parseMpdLogLines(added.lines);
        for (const p of firstParsed) {
          fileCount++;
          broadcast({
            type: "sync-progress",
            phase: "mpd",
            current: fileCount,
            total: 0,
            track: {
              title: path.basename(p.filePath),
              artist: "",
              album: path.dirname(p.filePath),
            },
          });
        }
      }

      while (true) {
        await new Promise((r) => setTimeout(r, 2000));

        const { lines } = readNewMpdLogLines(logPos);
        const parsed = parseMpdLogLines(lines);
        for (const p of parsed) {
          fileCount++;
          broadcast({
            type: "sync-progress",
            phase: "mpd",
            current: fileCount,
            total: 0,
            track: {
              title: path.basename(p.filePath),
              artist: "",
              album: path.dirname(p.filePath),
            },
          });
        }
        logPos = readNewMpdLogLines(logPos).newPosition;

        const r = await this.mpdConnectionManager.executeCommand("status");
        if (!parseKeyValue(r).updating_db) {
          this.logService.pushLog(
            "info",
            `MPD library update finished (${fileCount} files indexed)`,
          );
          break;
        }
      }
    } else {
      this.logService.pushLog(
        "info",
        "MPD library update completed (no changes detected)",
      );
    }
  }

  async initDatabase(): Promise<void> {
    await initDatabase();
  }

  async fetchAllTracksFromMPD(): Promise<MPDTrack[]> {
    const mpdTracks: MPDTrack[] = [];
    try {
      console.log("📀 Fetching albums...");
      const albumsRaw = await this.mpdConnectionManager.executeCommand("list", [
        "album",
      ]);
      const albums = albumsRaw
        .split("\n")
        .map((line) => line.replace("Album: ", "").trim())
        .filter((line) => line.trim() !== "");
      console.log(`   📀 Found ${albums.length} albums`);

      for (const album of albums) {
        try {
          const raw = await this.mpdConnectionManager.executeCommand("find", [
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

  getStats(): {
    totalTracks: number;
    lastSync?: Date;
  } {
    return {
      totalTracks: tracksDb.count(),
      lastSync: syncMetadataDb.getLastSync(),
    };
  }

  clearAll(): void {
    console.log("⚠️  Clearing all database data...");
    librarySyncDb.clearAll();
    console.log("✅ Database cleared");
  }
}
