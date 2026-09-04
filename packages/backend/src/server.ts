import "dotenv/config";
import app from "./app";
import { WebSocketServer } from "ws";
import { setupPlayerWebSocket } from "./ws/player.ws";
import { setWss, broadcast } from "./ws/broadcast";
import { setBroadcaster } from "./services/logService";
import { initDatabase } from "@repo/db";
import { mpdConnectionManager } from "./services/mpdConnectionManager";
import { autoplayService } from "./services/autoplayService";
import { getQueue, queueFiles } from "./services/playerService";
import { PlayTrackingService } from "./services/playTrackingService";
import { mountAllEnabled } from "./services/storageService";

// Wire up autoplay callback
mpdConnectionManager.setAutoplayCallback(async (currentFile: string) => {
  const sessionId = autoplayService.sessionId;
  const queue = await getQueue();
  if (autoplayService.sessionId !== sessionId) return;

  const tracks = await autoplayService.getNextBatch(currentFile, {
    queuedFiles: queue.map((track) => track.file),
  });
  if (tracks.length > 0 && autoplayService.sessionId === sessionId) {
    await queueFiles(tracks);
    autoplayService.commitBatch(tracks, sessionId);
  }
});

const PORT = parseInt(process.env.PORT ?? "3000", 10);

let wss: WebSocketServer;
let server: ReturnType<typeof app.listen>;

async function main() {
  // Initialize database
  await initDatabase();

  // HTTP server
  server = app.listen(PORT, () => {
    console.log(`🚀 Backend Express su http://localhost:${PORT}`);
  });

  // WebSocket server
  wss = new WebSocketServer({ server });
  setWss(wss);
  setBroadcaster(broadcast);
  setupPlayerWebSocket(wss);

  // MPD connection manager (idle loop, state cache, command queue)
  mpdConnectionManager.start();

  // Track play tracking
  const playTracking = new PlayTrackingService(mpdConnectionManager);
  playTracking.start();

  // Re-mount enabled storage sources
  mountAllEnabled().catch((err) => {
    console.error("[Server] Failed to restore storage mounts:", err);
  });
}

// Graceful shutdown
function shutdown() {
  console.log("\nShutting down...");

  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 5000);

  try {
    mpdConnectionManager.stop();
  } catch {
    // MPD disconnect may fail if unreachable — continue shutdown
  }

  if (wss) {
    wss.clients.forEach((client) => client.terminate());
    wss.close();
  }

  if (server) {
    server.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
