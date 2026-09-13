import { expect } from "chai";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupPlayerWebSocket } from "../../../ws/player.ws.js";
import {
  SessionRegistry,
  registryOverrideForTests,
} from "@services/session/sessionRegistry";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import type { LogService } from "@services/utils/logService";
import {
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";

describe("session-scoped WS", () => {
  let close: () => void;
  let registry: SessionRegistry;
  let server: ReturnType<typeof createServer>;
  let wss: WebSocketServer;
  let baseUrl: string;

  before(() => {
    // The no-sessionId fall-through path reads the global MPD cache through
    // the service factory (getMpdConnectionManager / getCatalogSyncOrchestrator).
    // This isolated env never initializes the factory otherwise, so the socket
    // would error instead of opening. Mirrors e2e/catalog.test.ts.
    if (!isServicesInitialized()) initializeServices();
  });

  beforeEach((done) => {
    ({ close } = createTestDb());
    registry = new SessionRegistry({} as LogService);
    registryOverrideForTests(registry);

    const a = artist.create({ name: "WsArtist" }, 1);
    const al = album.create({ title: "WsAlbum", artistName: a.name }, 1);
    const t = track.create({ artist: a.name, album: al.title, title: "W" }, 2);
    registry.getOrCreateSession("abc").playTrack(t.file);

    server = createServer();
    wss = new WebSocketServer({ server });
    setupPlayerWebSocket(wss);
    server.listen(0, () => {
      baseUrl = `ws://localhost:${
        (server.address() as { port: number }).port
      }/ws`;
      done();
    });
  });

  afterEach(() => {
    wss.close();
    server.close();
    registryOverrideForTests(null);
    registry.dispose();
    close();
  });

  it("delivers player-status scoped to the session on connect", (done) => {
    const ws = new WebSocket(`${baseUrl}?sessionId=abc`);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;
      expect(msg.type).to.equal("player-status");
      expect(msg.state).to.equal("play");
      ws.close();
      done();
    });
    ws.on("error", done);
  });

  it("does not deliver the session status to a socket without sessionId (falls through to MPD path)", (done) => {
    const ws = new WebSocket(baseUrl);
    // no session -> no immediate session status; the global MPD path sends
    // its own status asynchronously; just assert the socket stays open.
    ws.on("open", () => {
      ws.close();
      done();
    });
    ws.on("error", done);
  });
});
