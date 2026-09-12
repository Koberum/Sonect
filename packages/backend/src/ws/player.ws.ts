import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import {
  getMpdConnectionManager,
  getCatalogSyncOrchestrator,
} from "@services/factory";
import { resolveSessionRegistry } from "@services/session/sessionRegistry.js";

function isWsOpen(ws: WebSocket): boolean {
  return ws.readyState === WebSocket.OPEN;
}

function sendJson(ws: WebSocket, data: unknown) {
  if (isWsOpen(ws)) ws.send(JSON.stringify(data));
}

export function setupPlayerWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    console.log("WS client connected");

    const q = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get(
      "sessionId",
    );
    if (q) {
      // getOrCreateSession makes sessions idempotent; a WS connect is a touch,
      // so an unknown id simply starts a fresh session (spec decision).
      const session = resolveSessionRegistry().getOrCreateSession(q);
      const sendStatus = () =>
        sendJson(ws, { type: "player-status", ...session.getStatus() });
      session.getStatus(); // primes lastActiveAt
      sendStatus();
      session.on("stateChanged", sendStatus);
      ws.on("close", () => session.off("stateChanged", sendStatus));
      ws.on("error", (err) => {
        console.error("WS error:", err);
        session.off("stateChanged", sendStatus);
      });
      return;
    }

    const mpdConnectionManager = getMpdConnectionManager();
    const catalogSyncOrchestrator = getCatalogSyncOrchestrator();

    const sendState = () => {
      sendJson(ws, {
        type: "player-status",
        ...mpdConnectionManager.getCachedStatus(),
      });
    };

    sendState();

    // Send current sync state if a scan is running
    const syncState = catalogSyncOrchestrator.getCurrentSyncProgress();
    if (syncState) {
      sendJson(ws, { type: "sync-progress", ...syncState });
    }

    const onStateChanged = () => sendState();

    mpdConnectionManager.on("stateChanged", onStateChanged);

    ws.on("close", () => {
      mpdConnectionManager.off("stateChanged", onStateChanged);
      console.log("WS client disconnected");
    });

    ws.on("error", (err) => {
      console.error("WS error:", err);
      mpdConnectionManager.off("stateChanged", onStateChanged);
    });
  });
}
