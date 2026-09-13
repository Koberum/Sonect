import { apiFetch } from "@/lib/api";
import { sessionHeaders } from "@/lib/session";
import type { QueuedTrack } from "@repo/types";
import type { Track } from "@repo/types/catalog";

export function playSong(track: Track): Promise<void> {
  return apiFetch("/mpd/play", {
    method: "POST",
    headers: sessionHeaders(),
    body: { file: track.file },
  });
}

export function pauseSong(): Promise<void> {
  return apiFetch("/mpd/pause", {
    method: "POST",
    headers: sessionHeaders(),
    body: {},
  });
}

export function nextTrack(): Promise<void> {
  return apiFetch("/mpd/next", {
    method: "POST",
    headers: sessionHeaders(),
    body: {},
  });
}

export function previousTrack(): Promise<void> {
  return apiFetch("/mpd/previous", {
    method: "POST",
    headers: sessionHeaders(),
    body: {},
  });
}

export function setRandom(enabled: boolean): Promise<void> {
  return apiFetch("/mpd/random", {
    method: "POST",
    headers: sessionHeaders(),
    body: { enabled },
  });
}

export function setRepeat(enabled: boolean): Promise<void> {
  return apiFetch("/mpd/repeat", {
    method: "POST",
    headers: sessionHeaders(),
    body: { enabled },
  });
}

export function goToPosition(position: number): Promise<void> {
  return apiFetch("/mpd/position", {
    method: "POST",
    headers: sessionHeaders(),
    body: { position },
  });
}

export function setVolume(volume: number): Promise<void> {
  return apiFetch("/mpd/volume", {
    method: "PATCH",
    headers: sessionHeaders(),
    body: { volume },
  });
}

export function getQueue(signal?: AbortSignal): Promise<QueuedTrack[]> {
  return apiFetch("/mpd/queue", { headers: sessionHeaders(), signal });
}

export function playQueueItem(pos: number): Promise<void> {
  return apiFetch("/mpd/play-position", {
    method: "POST",
    headers: sessionHeaders(),
    body: { pos },
  });
}

export function removeFromQueue(pos: number): Promise<void> {
  return apiFetch("/mpd/remove-from-queue", {
    method: "POST",
    headers: sessionHeaders(),
    body: { pos },
  });
}

export function addToQueue(file: string): Promise<void> {
  return apiFetch("/mpd/add-to-queue", {
    method: "POST",
    headers: sessionHeaders(),
    body: { file },
  });
}

export function moveQueueItem(from: number, to: number): Promise<void> {
  return apiFetch("/mpd/move-queue", {
    method: "POST",
    headers: sessionHeaders(),
    body: { from, to },
  });
}
