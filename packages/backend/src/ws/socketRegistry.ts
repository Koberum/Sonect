import type { WebSocket } from "ws";

const profileSockets = new Map<string, Set<WebSocket>>();

export function registerProfileSocket(
  profileId: string,
  socket: WebSocket,
): void {
  let sockets = profileSockets.get(profileId);
  if (!sockets) {
    sockets = new Set();
    profileSockets.set(profileId, sockets);
  }
  sockets.add(socket);
}

export function unregisterProfileSocket(
  profileId: string,
  socket: WebSocket,
): void {
  const sockets = profileSockets.get(profileId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) profileSockets.delete(profileId);
}

export function closeProfileSockets(
  profileId: string,
  code = 4401,
  reason = "Session revoked",
): void {
  const sockets = profileSockets.get(profileId);
  if (!sockets) return;
  profileSockets.delete(profileId);
  for (const socket of sockets) {
    try {
      socket.close(code, reason);
    } catch {
      // Socket may already be closing or closed.
    }
  }
}
