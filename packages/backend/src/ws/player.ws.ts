import { WebSocketServer, WebSocket } from "ws";
import { mpdConnectionManager } from "@services/mpd/mpdConnectionManager";
import { getCurrentSyncProgress } from "@services/library/libraryService";

function isWsOpen(ws: WebSocket): boolean {
  return ws.readyState === WebSocket.OPEN;
}

function sendJson(ws: WebSocket, data: unknown) {
  if (isWsOpen(ws)) ws.send(JSON.stringify(data));
}

export function setupPlayerWebSocket(wss: WebSocketServer) {
  wss.on("connection", (ws: WebSocket) => {
    console.log("WS client connected");

    const sendState = () => {
      sendJson(ws, {
        type: "player-status",
        ...mpdConnectionManager.getCachedStatus(),
      });
    };

    sendState();

    // Send current sync state if a scan is running
    const syncState = getCurrentSyncProgress();
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
