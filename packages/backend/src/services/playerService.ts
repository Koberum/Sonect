import { PlayTrackError } from "@repo/types";
import { PlayTrackResponse, PlaybackStatus, QueuedTrack } from "@repo/types";
import { mpdConnectionManager } from "./mpdConnectionManager";
import { autoplayService } from "./autoplayService";
import { tracksDb, albumsDb } from "@repo/db";
import type { MPDTrack } from "@repo/types";
import { parseKeyValue, hashFile } from "../utils/mpd.js";
import { broadcast } from "../ws/broadcast";
import { pushLog } from "./logService";
import { readNewMpdLogLines, parseMpdLogLines } from "./mpdLogReader";
import path from "path";

export function getPlaybackStatus(): PlaybackStatus {
  return mpdConnectionManager.getCachedStatus();
}

export async function playTrack(file?: string): Promise<PlayTrackResponse> {
  try {
    if (!file) throw new PlayTrackError("File non specificato");

    const dbTrack = tracksDb.getByFile(file);
    const commands: { command: string; args?: string[] }[] = [
      { command: "clear" },
    ];

    if (dbTrack?.album_id) {
      const albumTracks = tracksDb.getByAlbumOrdered(dbTrack.album_id);
      const clickIdx = albumTracks.findIndex((t) => t.file === file);
      const ordered =
        clickIdx >= 0
          ? [...albumTracks.slice(clickIdx), ...albumTracks.slice(0, clickIdx)]
          : albumTracks;
      for (const t of ordered) {
        commands.push({ command: "add", args: [t.file] });
      }
    } else {
      commands.push({ command: "add", args: [file] });
    }

    commands.push({ command: "consume", args: ["1"] });
    commands.push({ command: "play" });

    await mpdConnectionManager.executeCommandList(commands);

    if (mpdConnectionManager.autoplayEnabled) {
      const tracks = await autoplayService.getNextBatch(file);
      if (tracks.length > 0) {
        await queueFiles(tracks);
      }
    }

    mpdConnectionManager.refreshNow().catch((err) => {
      console.error("[Player] refreshNow failed after playTrack:", err);
    });

    return { success: true };
  } catch (err: any) {
    if (err instanceof PlayTrackError) throw err;
    throw new PlayTrackError(err.message);
  }
}

export async function pauseTrack(): Promise<PlayTrackResponse> {
  await mpdConnectionManager.executeCommand("pause");
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after pauseTrack:", err);
  });
  return { success: true };
}

async function populateQueue(tracks: MPDTrack[]): Promise<void> {
  const commands = tracks.map((track) => ({
    command: "add" as const,
    args: [track.file],
  }));
  await mpdConnectionManager.executeCommandList(commands);
}

export async function queueFiles(files: string[]): Promise<void> {
  if (files.length === 0) return;
  const commands = files.map((f) => ({
    command: "add" as const,
    args: [f],
  }));
  await mpdConnectionManager.executeCommandList(commands);
}

export async function clearQueue(): Promise<void> {
  await mpdConnectionManager.executeCommand("clear");
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after clearQueue:", err);
  });
}

export function isAutoplayEnabled(): boolean {
  return mpdConnectionManager.autoplayEnabled;
}

export function setAutoplayEnabled(enabled: boolean): void {
  mpdConnectionManager.autoplayEnabled = enabled;
}

export async function getQueue(): Promise<QueuedTrack[]> {
  const raw = await mpdConnectionManager.executeCommand("playlistinfo");
  return parseQueueResponse(raw);
}

function parseQueueResponse(raw: string): QueuedTrack[] {
  const lines = raw.split("\n");
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (line.startsWith("file: ") && cur.length > 0) {
      blocks.push(cur);
      cur = [];
    }
    cur.push(line);
  }
  if (cur.length > 0) blocks.push(cur);

  return blocks.map((entryLines) => {
    const kv: Record<string, string> = {};
    for (const line of entryLines) {
      const idx = line.indexOf(": ");
      if (idx !== -1) kv[line.slice(0, idx)] = line.slice(idx + 2);
    }

    const album = kv.Album
      ? albumsDb.getByTitleAndArtist(kv.Album, kv.Artist || "")
      : undefined;

    return {
      id: kv.file ? hashFile(kv.file) : 0,
      file: kv.file || "",
      title: kv.Title || "Unknown",
      artist_name: kv.Artist || "Unknown",
      album: kv.Album || "",
      duration: parseFloat(kv.Duration ?? kv.Time ?? "0") || 0,
      pos: parseInt(kv.Pos ?? "0", 10) || 0,
      mpdId: parseInt(kv.Id ?? "0", 10) || 0,
      cover_path: album?.cover_path ?? "",
    };
  });
}

export async function nextTrack(): Promise<void> {
  await mpdConnectionManager.executeCommand("next");
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after nextTrack:", err);
  });
}

export async function previousTrack(): Promise<void> {
  await mpdConnectionManager.executeCommand("previous");
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after previousTrack:", err);
  });
}

export async function goToPosition(position: number): Promise<void> {
  await mpdConnectionManager.executeCommand("seekcur", [position.toString()]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after goToPosition:", err);
  });
}

export async function enableRepeat(enabled: boolean): Promise<void> {
  await mpdConnectionManager.executeCommand("repeat", [enabled ? "1" : "0"]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after enableRepeat:", err);
  });
}

export async function enableRandom(enabled: boolean): Promise<void> {
  await mpdConnectionManager.executeCommand("random", [enabled ? "1" : "0"]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after enableRandom:", err);
  });
}

export async function enableConsume(enabled: boolean): Promise<void> {
  await mpdConnectionManager.executeCommand("consume", [enabled ? "1" : "0"]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after enableConsume:", err);
  });
}

export async function setSingle(enabled: boolean): Promise<void> {
  await mpdConnectionManager.executeCommand("single", [enabled ? "1" : "0"]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after setSingle:", err);
  });
}

export async function setVolume(volume: number): Promise<void> {
  if (volume < 0 || volume > 100) {
    throw new Error("Volume needs to be between 0 and 100");
  }
  await mpdConnectionManager.executeCommand("setvol", [volume.toString()]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after setVolume:", err);
  });
}

export async function playPosition(pos: number): Promise<void> {
  await mpdConnectionManager.executeCommand("play", [pos.toString()]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after playPosition:", err);
  });
}

export async function removeFromQueue(pos: number): Promise<void> {
  await mpdConnectionManager.executeCommand("delete", [pos.toString()]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after removeFromQueue:", err);
  });
}

export async function addToQueue(file: string): Promise<void> {
  await mpdConnectionManager.executeCommand("add", [file]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after addToQueue:", err);
  });
}

export async function moveQueueItem(from: number, to: number): Promise<void> {
  await mpdConnectionManager.executeCommand("move", [
    from.toString(),
    to.toString(),
  ]);
  mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after moveQueueItem:", err);
  });
}

export async function updateLibrary(): Promise<void> {
  const cmdClient = mpdConnectionManager.getCmdClient();
  if (!cmdClient) throw new Error("MPD cmd client not connected");

  let fileCount = 0;
  let logPos = 0;

  pushLog("info", "Starting MPD library update");
  await mpdConnectionManager.executeCommand("update");

  await new Promise((r) => setTimeout(r, 500));

  const raw = await mpdConnectionManager.executeCommand("status");
  const status = parseKeyValue(raw);

  if (status.updating_db) {
    const added = readNewMpdLogLines(0);
    logPos = added.newPosition;

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

      const r = await mpdConnectionManager.executeCommand("status");
      if (!parseKeyValue(r).updating_db) {
        pushLog(
          "info",
          `MPD library update finished (${fileCount} files indexed)`,
        );
        break;
      }
    }
  } else {
    pushLog("info", "MPD library update completed (no changes detected)");
  }
}
