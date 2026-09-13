import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import {
  getMpdConnectionManager,
  getCatalogSyncOrchestrator,
} from "@services/factory";
import { resolveSessionRegistry } from "@services/session/sessionRegistry.js";
import { resolvePlayerRouter } from "@services/player/playerRouter.js";

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
      // Unified path: per-session isolated, backend decides engine via PlayerRouter
      try {
        const router = resolvePlayerRouter();
        const engine = router.forSession(q);
        const sendStatus = () =>
          sendJson(ws, { type: "player-status", ...engine.getStatus() });
        // primes lastActiveAt for browser engine
        try {
          engine.getStatus();
        } catch {
          // ignore for mpd adapter
        }
        sendStatus();
        engine.on("stateChanged", sendStatus);
        ws.on("close", () => engine.off("stateChanged", sendStatus));
        ws.on("error", (err) => {
          console.error("WS error:", err);
          engine.off("stateChanged", sendStatus);
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
      } catch {
        // Fallback to legacy session handling if router not ready
        const session = resolveSessionRegistry().getOrCreateSession(q);
        const sendStatus = () =>
          sendJson(ws, { type: "player-status", ...session.getStatus() });
        session.getStatus();
        sendStatus();
        session.on("stateChanged", sendStatus);
        ws.on("close", () => session.off("stateChanged", sendStatus));
        ws.on("error", (err) => {
          console.error("WS error:", err);
          session.off("stateChanged", sendStatus);
        });
        return;
      }
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
