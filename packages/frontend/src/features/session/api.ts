import { apiFetch } from "@/lib/api";
import { sessionHeaders } from "@/lib/session";
import type { SessionQueueEntry, PlaybackStatus } from "@repo/types";

const h = sessionHeaders;

export function sessionPlay(filename: string): Promise<{ success: boolean }> {
  return apiFetch("/session/player/play", {
    method: "POST",
    headers: h(),
    body: { file: filename },
  });
}
export function sessionPause(): Promise<{ success: boolean }> {
  return apiFetch("/session/player/pause", {
    method: "POST",
    headers: h(),
    body: {},
  });
}
export function sessionResume(): Promise<{ success: boolean }> {
  return apiFetch("/session/player/resume", {
    method: "POST",
    headers: h(),
    body: {},
  });
}
export function sessionNext(): Promise<{ success: boolean }> {
  return apiFetch("/session/player/next", {
    method: "POST",
    headers: h(),
    body: {},
  });
}
export function sessionPrevious(): Promise<{ success: boolean }> {
  return apiFetch("/session/player/previous", {
    method: "POST",
    headers: h(),
    body: {},
  });
}
export function sessionSeek(position: number): Promise<{ success: boolean }> {
  return apiFetch("/session/player/seek", {
    method: "POST",
    headers: h(),
    body: { position },
  });
}
export function sessionAddToQueue(file: string): Promise<{ success: boolean }> {
  return apiFetch("/session/queue", {
    method: "POST",
    headers: h(),
    body: { file },
  });
}
export function sessionRemoveFromQueue(
  pos: number,
): Promise<{ success: boolean }> {
  return apiFetch(`/session/queue/${pos}`, { method: "DELETE", headers: h() });
}
export function sessionMoveQueueItem(
  from: number,
  to: number,
): Promise<{ success: boolean }> {
  return apiFetch("/session/queue/move", {
    method: "POST",
    headers: h(),
    body: { from, to },
  });
}
export function sessionGetQueue(
  signal?: AbortSignal,
): Promise<SessionQueueEntry[]> {
  return apiFetch("/session/queue", { headers: h(), signal });
}
export function sessionGetStatus(
  signal?: AbortSignal,
): Promise<PlaybackStatus> {
  return apiFetch("/session/status", { headers: h(), signal });
}
