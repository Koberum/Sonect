import { expect } from "chai";
import request from "supertest";
import express from "express";
import { errorHandler } from "@middleware/errorHandler";
import sessionRoutes from "@routes/sessionRoutes";
import {
  SessionRegistry,
  registryOverrideForTests,
} from "@services/session/sessionRegistry";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import type { LogService } from "@services/utils/logService";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/session", sessionRoutes);
  app.use(errorHandler);
  return app;
}

describe("session routes", () => {
  let close: () => void;
  let registry: SessionRegistry;

  beforeEach(() => {
    ({ close } = createTestDb());
    registry = new SessionRegistry({} as LogService);
    registryOverrideForTests(registry);
  });

  afterEach(() => {
    registryOverrideForTests(null);
    registry.dispose();
    close();
  });

  it("requires X-Session-Id", async () => {
    const res = await request(makeApp()).get("/session/status");
    expect(res.status).to.equal(400);
  });

  it("play builds an album-through-end session and status reflects it", async () => {
    const a = artist.create({ name: "RouterArtist" }, 1);
    const al = album.create({ title: "RouterAlbum", artistName: a.name }, 1);
    const t = track.create({ artist: a.name, album: al.title, title: "A" }, 2);

    const app = makeApp();
    const post = await request(app)
      .post("/session/player/play")
      .set("X-Session-Id", "R1")
      .send({ file: t.file });
    expect(post.status).to.equal(200);

    const get = await request(app)
      .get("/session/status")
      .set("X-Session-Id", "R1");
    expect(get.status).to.equal(200);
    expect(get.body.state).to.equal("play");
  });
});
