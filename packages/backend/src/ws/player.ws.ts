import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import {
  getMpdConnectionManager,
  getCatalogSyncOrchestrator,
  getLogService,
} from "@services/factory";
import { resolveSessionRegistry } from "@services/session/sessionRegistry.js";
import { resolvePlayerRouter } from "@services/player/playerRouter.js";

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
    const sid = new URLSearchParams((req.url ?? "").split("?")[1] ?? "").get(
      "sessionId",
    );
    const fmtSid = sid ? sid.slice(0, 8) : "none";
    const ip = (req.socket.remoteAddress ?? "unknown").replace("::ffff:", "");
    if (sid) {
      // Unified path: per-session isolated, backend decides engine via PlayerRouter
      try {
        const router = resolvePlayerRouter();
        const engine = router.forSession(sid);
        const mode = router.getMode(sid);
        safeLog(
          "debug",
          `[WS][Session ${fmtSid}][${mode}] connected from ${ip}`,
          {
            sessionId: fmtSid,
            mode,
            ip,
          },
        );
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
        ws.on("close", () => {
          safeLog("debug", `[WS][Session ${fmtSid}] disconnected`, {
            sessionId: fmtSid,
          });
          engine.off("stateChanged", sendStatus);
        });
        ws.on("error", (err) => {
          console.error("WS error:", err);
          safeLog("warn", `[WS][Session ${fmtSid}] error: ${String(err)}`, {
            sessionId: fmtSid,
            error: String(err),
          });
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
          session.off("stateChanged", sendStatus);
        });
        return;
      }
    }

    safeLog("debug", `[WS][legacy] connected without sessionId from ${ip}`, {
      ip,
    });
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
      safeLog("debug", `[WS][legacy] disconnected`, {});
      mpdConnectionManager.off("stateChanged", onStateChanged);
      console.log("WS client disconnected");
    });

    ws.on("error", (err) => {
      console.error("WS error:", err);
      safeLog("warn", `[WS][legacy] error: ${String(err)}`, {
        error: String(err),
      });
      mpdConnectionManager.off("stateChanged", onStateChanged);
    });
  });
}
