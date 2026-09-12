import "dotenv/config";
import app from "./app";
import { WebSocketServer } from "ws";
import { setupPlayerWebSocket } from "./ws/player.ws";
import { setWss, broadcast } from "./ws/broadcast";
import { closeDb, initDatabase } from "@repo/db";
import {
  initializeServices,
  getMpdConnectionManager,
  getPlayTrackingService,
  getStorageService,
  getLogService,
} from "@services/factory";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

let wss: WebSocketServer;
let server: ReturnType<typeof app.listen>;
let shuttingDown = false;

async function main() {
  // Initialize database
  await initDatabase();

  // Initialize all services in correct dependency order
  initializeServices();

  // HTTP server
  server = app.listen(PORT, () => {
    console.log(`🚀 Backend Express su http://localhost:${PORT}`);
  });

  // WebSocket server
  wss = new WebSocketServer({ server });
  setWss(wss);
  getLogService().setBroadcaster(broadcast);
  setupPlayerWebSocket(wss);

  // MPD connection manager (idle loop, state cache, command queue)
  getMpdConnectionManager().start();

  // Track play tracking
  const playTracking = getPlayTrackingService();
  playTracking.start();

  // Re-mount enabled storage sources
  getStorageService()
    .mountAllEnabled()
    .catch((err) => {
      getLogService().pushLog(
        "error",
        `[Server] Failed to restore storage mounts: ${String(err)}`,
      );
    });
}

// Graceful shutdown — server.ts is the sole owner of process termination.
function finish() {
  // Checkpoint WAL and close SQLite; no-op when the DB was never opened.
  closeDb();
  process.exit(0);
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\nShutting down...");

  setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, 5000);

  try {
    getMpdConnectionManager().stop();
  } catch {
    // MPD disconnect may fail if unreachable — continue shutdown
  }

  if (wss) {
    wss.clients.forEach((client) => client.terminate());
    wss.close();
  }

  if (server) {
    server.close(finish);
  } else {
    finish();
  }
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

main().catch((err) => {
  console.error("Failed to start:", err);
  // Initialization may have partially opened the database; closeDb is a
  // no-op when nothing was opened.
  closeDb();
  process.exit(1);
});
