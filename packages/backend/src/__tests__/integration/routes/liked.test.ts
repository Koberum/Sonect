import { expect } from "chai";
import express from "express";
import request from "supertest";
import likedRoutes from "@routes/likedRoutes";
import { authenticate } from "@middleware/auth";
import { errorHandler } from "@middleware/errorHandler";
import { createTestDb } from "@tests/helpers/db.js";
import { createTestSession } from "@tests/helpers/auth.js";
import {
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { db } from "@repo/db";
import { tracks } from "@repo/db";
import { eq } from "drizzle-orm";
import {
  registryOverrideForTests,
  SessionRegistry,
} from "@services/session/sessionRegistry.js";
import type { LogService } from "@services/utils/logService";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use("/likes", likedRoutes);
  app.use(errorHandler);
  return app;
}

describe("liked routes", () => {
  let close: () => void;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  function seedTrack(title: string, seed: number) {
    const a = artist.create({ name: `RouteArtist${seed}` }, seed);
    const al = album.create(
      { title: `RouteAlbum${seed}`, artistName: a.name },
      seed,
    );
    return track.create(
      {
        artist: a.name,
        album: al.title,
        title,
        file: `${a.name}/${title}.mp3`,
      },
      seed,
    );
  }

  it("requires authentication", async () => {
    const res = await request(makeApp()).get("/likes");
    expect(res.status).to.equal(401);
  });

  it("likes, lists, and reports ids for the current profile", async () => {
    const { cookie } = await createTestSession("user", "Liker");
    const t = seedTrack("RouteOne", 1);
    db().update(tracks).set({ duration: 120 }).where(eq(tracks.id, t.id)).run();
    const app = makeApp();

    const liked = await request(app)
      .put(`/likes/${t.id}`)
      .set("Cookie", cookie);
    expect(liked.status).to.equal(200);
    expect(liked.body).to.deep.equal({ liked: true });

    const ids = await request(app).get("/likes/ids").set("Cookie", cookie);
    expect(ids.status).to.equal(200);
    expect(ids.body).to.deep.equal({ ids: [t.id] });

    const list = await request(app).get("/likes").set("Cookie", cookie);
    expect(list.status).to.equal(200);
    expect(list.body.total).to.equal(1);
    expect(list.body.totalDuration).to.equal(120);
    expect(list.body.items).to.have.length(1);
    expect(list.body.items[0]).to.include({
      id: t.id,
      title: "RouteOne",
    });
  });

  it("is idempotent when liking twice", async () => {
    const { cookie } = await createTestSession("user", "Idem");
    const t = seedTrack("IdemTrack", 2);
    const app = makeApp();

    await request(app).put(`/likes/${t.id}`).set("Cookie", cookie);
    const second = await request(app)
      .put(`/likes/${t.id}`)
      .set("Cookie", cookie);

    expect(second.status).to.equal(200);
    const ids = await request(app).get("/likes/ids").set("Cookie", cookie);
    expect(ids.body.ids).to.deep.equal([t.id]);
  });

  it("unlikes a track", async () => {
    const { cookie } = await createTestSession("user", "Unliker");
    const t = seedTrack("UnlikeMe", 3);
    const app = makeApp();
    await request(app).put(`/likes/${t.id}`).set("Cookie", cookie);

    const removed = await request(app)
      .delete(`/likes/${t.id}`)
      .set("Cookie", cookie);

    expect(removed.status).to.equal(200);
    expect(removed.body).to.deep.equal({ liked: false });
    const list = await request(app).get("/likes").set("Cookie", cookie);
    expect(list.body.total).to.equal(0);
  });

  it("returns 404 when liking an unknown track", async () => {
    const { cookie } = await createTestSession("user", "Ghost");
    const res = await request(makeApp())
      .put("/likes/999999")
      .set("Cookie", cookie);
    expect(res.status).to.equal(404);
  });

  it("returns 400 for an invalid track id", async () => {
    const { cookie } = await createTestSession("user", "BadId");
    const res = await request(makeApp())
      .put("/likes/not-a-number")
      .set("Cookie", cookie);
    expect(res.status).to.equal(400);
  });

  it("keeps likes isolated between profiles", async () => {
    const first = await createTestSession("user", "First");
    const second = await createTestSession("user", "Second");
    const t = seedTrack("Isolated", 4);
    const app = makeApp();

    await request(app).put(`/likes/${t.id}`).set("Cookie", first.cookie);

    const firstIds = await request(app)
      .get("/likes/ids")
      .set("Cookie", first.cookie);
    const secondIds = await request(app)
      .get("/likes/ids")
      .set("Cookie", second.cookie);
    expect(firstIds.body.ids).to.deep.equal([t.id]);
    expect(secondIds.body.ids).to.deep.equal([]);
  });

  it("paginates likes", async () => {
    const { cookie } = await createTestSession("user", "Pager");
    const app = makeApp();
    const tracks = [1, 2, 3].map((seed) =>
      seedTrack(`PageTrack${seed}`, 10 + seed),
    );
    for (const t of tracks) {
      await request(app).put(`/likes/${t.id}`).set("Cookie", cookie);
    }

    const firstPage = await request(app)
      .get("/likes?limit=2&offset=0")
      .set("Cookie", cookie);
    const secondPage = await request(app)
      .get("/likes?limit=2&offset=2")
      .set("Cookie", cookie);

    expect(firstPage.body.items).to.have.length(2);
    expect(firstPage.body.total).to.equal(3);
    expect(secondPage.body.items).to.have.length(1);
  });

  it("plays every liked track in a new queue", async () => {
    const { cookie, id: profileId } = await createTestSession("user", "Player");
    const app = makeApp();
    const seeded = [1, 2, 3].map((seed) =>
      seedTrack(`PlayTrack${seed}`, 30 + seed),
    );
    for (const t of seeded) {
      await request(app).put(`/likes/${t.id}`).set("Cookie", cookie);
    }

    const registry = new SessionRegistry({} as LogService);
    registryOverrideForTests(registry);
    try {
      const res = await request(app)
        .post("/likes/play")
        .send({})
        .set("Cookie", cookie);

      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({ started: true, count: 3 });

      const session = registry.getSession(profileId);
      expect(session).to.not.be.null;
      expect(
        session!
          .getQueue()
          .map((entry) => entry.title)
          .sort(),
      ).to.deep.equal(["PlayTrack1", "PlayTrack2", "PlayTrack3"]);
      expect(session!.getStatus().state).to.equal("play");
    } finally {
      registryOverrideForTests(null);
      registry.dispose();
    }
  });

  it("honors shuffle when playing liked tracks", async () => {
    const { cookie, id: profileId } = await createTestSession(
      "user",
      "Shuffler",
    );
    const app = makeApp();
    const seeded = [1, 2, 3, 4].map((seed) =>
      seedTrack(`ShuffleTrack${seed}`, 40 + seed),
    );
    for (const t of seeded) {
      await request(app).put(`/likes/${t.id}`).set("Cookie", cookie);
    }

    const registry = new SessionRegistry({} as LogService);
    registryOverrideForTests(registry);
    try {
      const res = await request(app)
        .post("/likes/play")
        .send({ shuffle: true })
        .set("Cookie", cookie);

      expect(res.status).to.equal(200);
      expect(res.body.count).to.equal(4);
      const titles = registry
        .getSession(profileId)!
        .getQueue()
        .map((entry) => entry.title)
        .sort();
      expect(titles).to.deep.equal([
        "ShuffleTrack1",
        "ShuffleTrack2",
        "ShuffleTrack3",
        "ShuffleTrack4",
      ]);
    } finally {
      registryOverrideForTests(null);
      registry.dispose();
    }
  });

  it("returns 400 when playing an empty liked list", async () => {
    const { cookie } = await createTestSession("user", "EmptyPlayer");
    const res = await request(makeApp())
      .post("/likes/play")
      .send({})
      .set("Cookie", cookie);
    expect(res.status).to.equal(400);
  });
});
