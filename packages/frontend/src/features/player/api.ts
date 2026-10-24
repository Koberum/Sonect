import { apiFetch } from "@/lib/api";
import type { QueuedTrack, OutputMode } from "@repo/types";
import type { Track } from "@repo/types/catalog";

export function playSong(track: Track): Promise<void> {
  return apiFetch("/player/play", {
    method: "POST",
    body: { file: track.file },
  });
}
export function pauseSong(): Promise<void> {
  return apiFetch("/player/pause", { method: "POST", body: {} });
}
export function resumeSong(): Promise<void> {
  return apiFetch("/player/resume", { method: "POST", body: {} });
}
export function nextTrack(): Promise<void> {
  return apiFetch("/player/next", { method: "POST", body: {} });
}
export function previousTrack(): Promise<void> {
  return apiFetch("/player/previous", { method: "POST", body: {} });
}
export function setRandom(enabled: boolean): Promise<void> {
  return apiFetch("/player/random", { method: "POST", body: { enabled } });
}
export function setRepeat(enabled: boolean): Promise<void> {
  return apiFetch("/player/repeat", { method: "POST", body: { enabled } });
}
export function goToPosition(position: number): Promise<void> {
  return apiFetch("/player/seek", { method: "POST", body: { position } });
}
export function setVolume(volume: number): Promise<void> {
  return apiFetch("/player/volume", { method: "PATCH", body: { volume } });
}
export function getQueue(signal?: AbortSignal): Promise<QueuedTrack[]> {
  return apiFetch("/player/queue", { signal });
}
export function playQueueItem(pos: number): Promise<void> {
  return apiFetch("/player/play-position", { method: "POST", body: { pos } });
}
export function removeFromQueue(pos: number): Promise<void> {
  return apiFetch("/player/queue/" + pos, { method: "DELETE" });
}
export function addToQueue(file: string): Promise<void> {
  return apiFetch("/player/queue", { method: "POST", body: { file } });
}
export function getOutputMode(signal?: AbortSignal): Promise<{
  mode: OutputMode;
  deviceName: string | null;
  mpdOwner: string | null;
  activeDeviceId: string | null;
  activeDeviceName: string | null;
  activeDeviceType: string | null;
}> {
  return apiFetch("/player/output-mode", { signal });
}
export function setOutputMode(mode: OutputMode): Promise<{
  success: boolean;
  activeDeviceId?: string | null;
  activeDeviceName?: string | null;
  activeDeviceType?: string | null;
}> {
  return apiFetch("/player/output-mode", {
    method: "PUT",
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
