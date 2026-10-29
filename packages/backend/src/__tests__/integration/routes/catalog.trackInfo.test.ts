import { expect } from "chai";
import express from "express";
import request from "supertest";
import catalogRoutes from "@routes/catalogRoutes";
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

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use("/catalog", catalogRoutes);
  app.use(errorHandler);
  return app;
}

describe("GET /catalog/tracks/:id/info", () => {
  let close: () => void;
  const originalMusicDir = process.env.MUSIC_DIR;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });
  beforeEach(() => {
    ({ close } = createTestDb());
    process.env.MUSIC_DIR = "/libraries";
  });
  afterEach(() => {
    close();
    if (originalMusicDir === undefined) delete process.env.MUSIC_DIR;
    else process.env.MUSIC_DIR = originalMusicDir;
  });

  function seedTrack(seed: number) {
    const a = artist.create({ name: `InfoArtist${seed}` }, seed);
    const al = album.create(
      { title: `InfoAlbum${seed}`, artistName: a.name, year: 1999 },
      seed,
    );
    return track.create(
      {
        artist: a.name,
        album: al.title,
        title: `InfoTrack${seed}`,
        file: `${a.name}/InfoTrack${seed}.flac`,
        duration: 187.5,
        track: 3,
        disc: "1",
        date: "1999-05-01",
      },
      seed,
    );
  }

  it("requires authentication", async () => {
    const res = await request(makeApp()).get("/catalog/tracks/1/info");
    expect(res.status).to.equal(401);
  });

  it("returns the track info for an existing track", async () => {
    const { cookie } = await createTestSession("user", "InfoUser");
    const seeded = seedTrack(1);

    const res = await request(makeApp())
      .get(`/catalog/tracks/${seeded.id}/info`)
      .set("Cookie", cookie);

    expect(res.status).to.equal(200);
    expect(res.body).to.include({
      id: seeded.id,
      title: "InfoTrack1",
      file: "InfoArtist1/InfoTrack1.flac",
      absolutePath: "/libraries/InfoArtist1/InfoTrack1.flac",
      artist: "InfoArtist1",
      album: "InfoAlbum1",
      albumArtist: "InfoArtist1",
      year: 1999,
      date: "1999-05-01",
      trackNumber: 3,
      discNumber: 1,
      duration: 187.5,
      playCount: 0,
    });
    expect(res.body.storageSource).to.equal(null);
  });

  it("returns 404 for an unknown track", async () => {
    const { cookie } = await createTestSession("user", "InfoGhost");
    const res = await request(makeApp())
      .get("/catalog/tracks/999999/info")
      .set("Cookie", cookie);
    expect(res.status).to.equal(404);
  });

  it("returns 400 for an invalid id", async () => {
    const { cookie } = await createTestSession("user", "InfoBadId");
    const res = await request(makeApp())
      .get("/catalog/tracks/not-a-number/info")
      .set("Cookie", cookie);
    expect(res.status).to.equal(400);
  });
});
