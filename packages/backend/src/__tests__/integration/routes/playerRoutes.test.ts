import { expect } from "chai";
import request from "supertest";
import express from "express";
import { errorHandler } from "@middleware/errorHandler";
import { authenticate } from "@middleware/auth";
import playerRoutes from "@routes/unifiedPlayerRoutes";
import {
  SessionRegistry,
  registryOverrideForTests,
} from "@services/session/sessionRegistry";
import {
  getAuthService,
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import type { LogService } from "@services/utils/logService";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use("/player", playerRoutes);
  app.use(errorHandler);
  return app;
}

describe("player routes", () => {
  let close: () => void;
  let registry: SessionRegistry;
  let authCookie: string;
  let profileId: string;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });

  beforeEach(async () => {
    ({ close } = createTestDb());
    const { token, profile } = await getAuthService().bootstrap({
      name: "PlayerTester",
      password: "password123",
    });
    authCookie = `sonect_session=${token}`;
    profileId = profile.id;
    registry = new SessionRegistry({} as LogService);
    registryOverrideForTests(registry);
  });

  afterEach(() => {
    registryOverrideForTests(null);
    registry.dispose();
    close();
  });

  it("requires an authenticated session", async () => {
    const res = await request(makeApp()).get("/player/status");
    expect(res.status).to.equal(401);
  });

  it("rejects an X-Session-Id that does not match the authenticated profile", async () => {
    const res = await request(makeApp())
      .get("/player/status")
      .set("Cookie", authCookie)
      .set("X-Session-Id", "someone-else");
    expect(res.status).to.equal(403);
  });

  it("play builds an album-through-end session and status reflects it", async () => {
    const a = artist.create({ name: "RouterArtist" }, 1);
    const al = album.create({ title: "RouterAlbum", artistName: a.name }, 1);
    const t = track.create({ artist: a.name, album: al.title, title: "A" }, 2);

    const app = makeApp();
    const post = await request(app)
      .post("/player/play")
      .set("Cookie", authCookie)
      .set("X-Session-Id", profileId)
      .send({ file: t.file });
    expect(post.status).to.equal(200);

    const get = await request(app)
      .get("/player/status")
      .set("Cookie", authCookie)
      .set("X-Session-Id", profileId);
    expect(get.status).to.equal(200);
    expect(get.body.state).to.equal("play");
  });

  it("moves and clears the queue", async () => {
    const a = artist.create({ name: "QueueArtist" }, 10);
    const al = album.create({ title: "QueueAlbum", artistName: a.name }, 10);
    const t1 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "Queue A",
        track: 1,
        disc: "1",
      },
      11,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "Queue B",
        track: 2,
        disc: "1",
      },
      12,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "Queue C",
        track: 3,
        disc: "1",
      },
      13,
    );

    const app = makeApp();
    const play = await request(app)
      .post("/player/play")
      .set("Cookie", authCookie)
      .set("X-Session-Id", profileId)
      .send({ file: t1.file });
    expect(play.status).to.equal(200);

    const move = await request(app)
      .patch("/player/queue/move")
      .set("Cookie", authCookie)
      .set("X-Session-Id", profileId)
      .send({ from: 2, to: 0 });
    expect(move.status).to.equal(200);

    const afterMove = await request(app)
      .get("/player/queue")
      .set("Cookie", authCookie)
      .set("X-Session-Id", profileId);
    expect(afterMove.status).to.equal(200);
    expect(
      afterMove.body.slice(0, 3).map((entry: { title: string }) => entry.title),
    ).to.deep.equal(["Queue C", "Queue A", "Queue B"]);

    const clear = await request(app)
      .delete("/player/queue")
      .set("Cookie", authCookie)
      .set("X-Session-Id", profileId);
    expect(clear.status).to.equal(200);
    expect(clear.body.state).to.equal("stop");

    const afterClear = await request(app)
      .get("/player/queue")
      .set("Cookie", authCookie)
      .set("X-Session-Id", profileId);
    expect(afterClear.status).to.equal(200);
    expect(afterClear.body).to.deep.equal([]);
  });
});
