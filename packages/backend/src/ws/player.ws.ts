import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import {
  getAuthService,
  getCatalogSyncOrchestrator,
  getLogService,
} from "@services/factory";
import { getSessionTokenFromCookieHeader } from "@services/auth/cookies";
import { resolveSessionRegistry } from "@services/session/sessionRegistry.js";
import { resolvePlayerRouter } from "@services/player/playerRouter.js";
import {
  registerProfileSocket,
  unregisterProfileSocket,
} from "./socketRegistry.js";

function isWsOpen(ws: WebSocket): boolean {
  return ws.readyState === WebSocket.OPEN;
}

function sendJson(ws: WebSocket, data: unknown) {
  if (isWsOpen(ws)) ws.send(JSON.stringify(data));
}

function safeLog(
  level: "debug" | "info" | "warn" | "error",
  msg: string,
  data?: unknown,
): void {
  try {
    getLogService().pushLog(level, msg, data);
  } catch {
    // ignore when LogService not initialized (tests)
  }
}

export function setupPlayerWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const params = new URLSearchParams((req.url ?? "").split("?")[1] ?? "");
    const token = getSessionTokenFromCookieHeader(req.headers.cookie);
    const access = token ? getAuthService().validateSession(token) : null;
    if (!access) {
      ws.close(4401, "Unauthorized");
      return;
    }
    const sid = access.profile.id;
    const requestedSessionId = params.get("sessionId");
    if (requestedSessionId && requestedSessionId !== sid) {
      ws.close(4403, "Session mismatch");
      return;
    }
    registerProfileSocket(sid, ws);
    const did = params.get("deviceId") ?? params.get("device-id");
    const fmtSid = sid.slice(0, 8);
    const fmtDid = did ? did.slice(0, 8) : "none";
    const ip = (req.socket.remoteAddress ?? "unknown").replace("::ffff:", "");

    // Unified path: per-session isolated, backend decides engine via PlayerRouter
    try {
      const router = resolvePlayerRouter();
      const mode = router.getMode(sid);
      safeLog(
        "debug",
        `[WS][Session ${fmtSid}][${mode}] device=${fmtDid} connected from ${ip}`,
        {
          sessionId: fmtSid,
          deviceId: fmtDid,
          mode,
          ip,
        },
      );
      const sendStatus = () =>
        sendJson(ws, { type: "player-status", ...router.getStatus(sid) });
      sendStatus();
      const off = router.onStateChanged(sid, sendStatus);
      ws.on("close", () => {
        safeLog("debug", `[WS][Session ${fmtSid}] disconnected`, {
          sessionId: fmtSid,
        });
        unregisterProfileSocket(sid, ws);
        off();
      });
      ws.on("error", (err) => {
        console.error("WS error:", err);
        safeLog("warn", `[WS][Session ${fmtSid}] error: ${String(err)}`, {
          sessionId: fmtSid,
          error: String(err),
        });
        unregisterProfileSocket(sid, ws);
        off();
      });

      // Also send current sync state if a scan is running
      try {
        const catalogSyncOrchestrator = getCatalogSyncOrchestrator();
        const syncState = catalogSyncOrchestrator.getCurrentSyncProgress();
        if (syncState) sendJson(ws, { type: "sync-progress", ...syncState });
      } catch {
        // ignore
      }
      return;
    } catch (err) {
      safeLog(
        "warn",
        `[WS][Session ${fmtSid}] router not ready, fallback to SessionRegistry: ${String(err)}`,
        {
          sessionId: fmtSid,
          error: String(err),
        },
      );
      // Fallback to legacy session handling if router not ready
      const session = resolveSessionRegistry().getOrCreateSession(sid);
      const sendStatus = () =>
        sendJson(ws, { type: "player-status", ...session.getStatus() });
      session.getStatus();
      sendStatus();
      session.on("stateChanged", sendStatus);
      ws.on("close", () => {
        safeLog("debug", `[WS][Session ${fmtSid}] fallback disconnected`, {
          sessionId: fmtSid,
        });
        unregisterProfileSocket(sid, ws);
        session.off("stateChanged", sendStatus);
      });
      ws.on("error", (wsErr) => {
        console.error("WS error:", wsErr);
        safeLog(
          "warn",
          `[WS][Session ${fmtSid}] fallback error: ${String(wsErr)}`,
          {
            sessionId: fmtSid,
            error: String(wsErr),
          },
        );
        unregisterProfileSocket(sid, ws);
        session.off("stateChanged", sendStatus);
      });
    }
  });
}
