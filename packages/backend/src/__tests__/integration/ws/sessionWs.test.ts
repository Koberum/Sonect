import { expect } from "chai";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupPlayerWebSocket } from "../../../ws/player.ws.js";
import { closeProfileSockets } from "../../../ws/socketRegistry.js";
import {
  SessionRegistry,
  registryOverrideForTests,
} from "@services/session/sessionRegistry";
import { createTestDb } from "@tests/helpers/db.js";
import { createTestSession } from "@tests/helpers/auth.js";
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
  let cookie: string;
  let profileId: string;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });

  beforeEach(async () => {
    ({ close } = createTestDb());
    ({ id: profileId, cookie } = await createTestSession());
    registry = new SessionRegistry({} as LogService);
    registryOverrideForTests(registry);

    const a = artist.create({ name: "WsArtist" }, 1);
    const al = album.create({ title: "WsAlbum", artistName: a.name }, 1);
    const t = track.create({ artist: a.name, album: al.title, title: "W" }, 2);
    registry.getOrCreateSession(profileId).playTrack(t.file);

    await new Promise<void>((resolve) => {
      server = createServer();
      wss = new WebSocketServer({ server });
      setupPlayerWebSocket(wss);
      server.listen(0, () => {
        baseUrl = `ws://localhost:${
          (server.address() as { port: number }).port
        }/ws`;
        resolve();
      });
    });
  });

  afterEach(() => {
    wss.close();
    server.close();
    registryOverrideForTests(null);
    registry.dispose();
    close();
  });

  it("delivers player-status scoped to the authenticated session", (done) => {
    const ws = new WebSocket(`${baseUrl}?sessionId=${profileId}`, {
      headers: { Cookie: cookie },
    });
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;
      expect(msg.type).to.equal("player-status");
      expect(msg.state).to.equal("play");
      ws.close();
      done();
    });
    ws.on("error", done);
  });

  it("uses the authenticated profile id when sessionId is omitted", (done) => {
    const ws = new WebSocket(baseUrl, { headers: { Cookie: cookie } });
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;
      expect(msg.type).to.equal("player-status");
      expect(msg.state).to.equal("play");
      ws.close();
      done();
    });
    ws.on("error", done);
  });

  it("closes with 4401 when no session cookie is sent", (done) => {
    const ws = new WebSocket(baseUrl);
    ws.on("close", (code) => {
      try {
        expect(code).to.equal(4401);
        done();
      } catch (err) {
        done(err as Error);
      }
    });
    ws.on("error", done);
  });

  it("closes with 4401 when the profile's sessions are revoked", (done) => {
    const ws = new WebSocket(`${baseUrl}?sessionId=${profileId}`, {
      headers: { Cookie: cookie },
    });
    ws.on("message", () => {
      closeProfileSockets(profileId);
    });
    ws.on("close", (code) => {
      try {
        expect(code).to.equal(4401);
        done();
      } catch (err) {
        done(err as Error);
      }
    });
    ws.on("error", done);
  });

  it("closes with 4403 when the query sessionId mismatches the profile", (done) => {
    const ws = new WebSocket(`${baseUrl}?sessionId=someone-else`, {
      headers: { Cookie: cookie },
    });
    ws.on("close", (code) => {
      try {
        expect(code).to.equal(4403);
        done();
      } catch (err) {
        done(err as Error);
      }
    });
    ws.on("error", done);
  });
});
