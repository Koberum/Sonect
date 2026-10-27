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
  getLogService,
} from "@services/factory";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

let wss: WebSocketServer;
let server: ReturnType<typeof app.listen>;
let shuttingDown = false;

async function main() {
  // Initialize database
  await initDatabase();

  // Prune expired auth sessions
  const { authSessionsDb } = await import("@repo/db");
  authSessionsDb.deleteExpired(Date.now());

  // Initialize all services in correct dependency order
  initializeServices();

  // HTTP server
  server = app.listen(PORT, () => {
    getLogService().pushLog("info", `Backend listening on port ${PORT}`);
  });

  // WebSocket server
  wss = new WebSocketServer({ server });
  setWss(wss);
  getLogService().setBroadcaster(broadcast);
  setupPlayerWebSocket(wss);

  // Track play tracking (before MPD so the first status changes are observed)
  getPlayTrackingService().start();

  // MPD connection manager (idle loop, state cache, command queue)
  getMpdConnectionManager().start();
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
  try {
    getLogService().pushLog("info", "Shutting down...");
  } catch {
    // logger may not be initialized on very early signals
  }

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
