import { apiFetch } from "@/lib/api";
import { sessionHeaders } from "@/lib/session";
import type { QueuedTrack, PlaybackStatus, OutputMode } from "@repo/types";
import type { Track } from "@repo/types/catalog";

const h = sessionHeaders;

export function playSong(track: Track): Promise<void> {
  return apiFetch("/player/play", {
    method: "POST",
    headers: h(),
    body: { file: track.file },
  });
}
export function pauseSong(): Promise<void> {
  return apiFetch("/player/pause", { method: "POST", headers: h(), body: {} });
}
export function resumeSong(): Promise<void> {
  return apiFetch("/player/resume", { method: "POST", headers: h(), body: {} });
}
export function nextTrack(): Promise<void> {
  return apiFetch("/player/next", { method: "POST", headers: h(), body: {} });
}
export function previousTrack(): Promise<void> {
  return apiFetch("/player/previous", {
    method: "POST",
    headers: h(),
    body: {},
  });
}
export function setRandom(enabled: boolean): Promise<void> {
  return apiFetch("/player/random", {
    method: "POST",
    headers: h(),
    body: { enabled },
  });
}
export function setRepeat(enabled: boolean): Promise<void> {
  return apiFetch("/player/repeat", {
    method: "POST",
    headers: h(),
    body: { enabled },
  });
}
export function goToPosition(position: number): Promise<void> {
  return apiFetch("/player/seek", {
    method: "POST",
    headers: h(),
    body: { position },
  });
}
export function setVolume(volume: number): Promise<void> {
  return apiFetch("/player/volume", {
    method: "PATCH",
    headers: h(),
    body: { volume },
  });
}
export function getQueue(signal?: AbortSignal): Promise<QueuedTrack[]> {
  return apiFetch("/player/queue", { headers: h(), signal });
}
export function playQueueItem(pos: number): Promise<void> {
  return apiFetch("/player/play-position", {
    method: "POST",
    headers: h(),
    body: { pos },
  });
}
export function removeFromQueue(pos: number): Promise<void> {
  return apiFetch("/player/queue/" + pos, { method: "DELETE", headers: h() });
}
export function addToQueue(file: string): Promise<void> {
  return apiFetch("/player/queue", {
    method: "POST",
    headers: h(),
    body: { file },
  });
}
export function moveQueueItem(from: number, to: number): Promise<void> {
  return apiFetch("/player/queue/move", {
    method: "POST",
    headers: h(),
    body: { from, to },
  });
}
export function getStatus(signal?: AbortSignal): Promise<PlaybackStatus> {
  return apiFetch("/player/status", { headers: h(), signal });
}
export function getOutputMode(signal?: AbortSignal): Promise<{
  mode: OutputMode;
  deviceName: string | null;
  mpdOwner: string | null;
}> {
  return apiFetch("/player/output-mode", { headers: h(), signal });
}
export function setOutputMode(mode: OutputMode): Promise<{ success: boolean }> {
  return apiFetch("/player/output-mode", {
    method: "PUT",
    headers: h(),
    body: { mode },
  });
}

export interface WaveformData {
  samples: number[];
  duration: number;
  version: number;
}

export function getWaveform(
  trackId: number,
  signal?: AbortSignal,
): Promise<WaveformData> {
  return apiFetch(`/waveforms/${trackId}`, { signal });
}
