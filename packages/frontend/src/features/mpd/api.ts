import { apiFetch } from "@/lib/api";
import type { QueuedTrack } from "@repo/types";
import type { Track } from "@repo/types/catalog";

export function playSong(track: Track): Promise<void> {
  return apiFetch("/mpd/play", { method: "POST", body: { file: track.file } });
}

export function pauseSong(): Promise<void> {
  return apiFetch("/mpd/pause", { method: "POST", body: {} });
}

export function nextTrack(): Promise<void> {
  return apiFetch("/mpd/next", { method: "POST", body: {} });
}

export function previousTrack(): Promise<void> {
  return apiFetch("/mpd/previous", { method: "POST", body: {} });
}

export function setRandom(enabled: boolean): Promise<void> {
  return apiFetch("/mpd/random", { method: "POST", body: { enabled } });
}

export function setRepeat(enabled: boolean): Promise<void> {
  return apiFetch("/mpd/repeat", { method: "POST", body: { enabled } });
}

export function goToPosition(position: number): Promise<void> {
  return apiFetch("/mpd/position", { method: "POST", body: { position } });
}

export function setVolume(volume: number): Promise<void> {
  return apiFetch("/mpd/volume", { method: "PATCH", body: { volume } });
}

export function getQueue(signal?: AbortSignal): Promise<QueuedTrack[]> {
  return apiFetch("/mpd/queue", { signal });
}

export function playQueueItem(pos: number): Promise<void> {
  return apiFetch("/mpd/play-position", { method: "POST", body: { pos } });
}

export function removeFromQueue(pos: number): Promise<void> {
  return apiFetch("/mpd/remove-from-queue", { method: "POST", body: { pos } });
}

export function addToQueue(file: string): Promise<void> {
  return apiFetch("/mpd/add-to-queue", { method: "POST", body: { file } });
}
