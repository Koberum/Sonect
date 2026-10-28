import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import request from "supertest";
import streamRoutes from "@routes/streamRoutes";
import { authenticate } from "@middleware/auth";
import { errorHandler } from "@middleware/errorHandler";
import { createTestDb } from "@tests/helpers/db.js";
import { createTestSession } from "@tests/helpers/auth.js";
import {
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";
import { track } from "@tests/factories/track.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use("/stream", streamRoutes);
  app.use(errorHandler);
  return app;
}

describe("stream routes", () => {
  let close: () => void;
  let tmpDir: string;
  let cookie: string;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });

  beforeEach(async () => {
    ({ close } = createTestDb());
    ({ cookie } = await createTestSession());
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-stream-"));
    process.env.MUSIC_DIR = tmpDir;
  });

  afterEach(() => {
    close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.MUSIC_DIR;
  });

  it("requires authentication", async () => {
    const res = await request(makeApp()).get("/stream/1");
    expect(res.status).to.equal(401);
  });

  it("rejects invalid and unknown track ids", async () => {
    const app = makeApp();
    const invalid = await request(app)
      .get("/stream/not-a-number")
      .set("Cookie", cookie);
    expect(invalid.status).to.equal(400);

    const missing = await request(app)
      .get("/stream/999999")
      .set("Cookie", cookie);
    expect(missing.status).to.equal(404);
  });

  it("streams a track whose filename has special characters", async () => {
    const file = "Artist/Album/12 - Fonoteca #1 ? 100% &+ ü.flac";
    const absolute = path.join(tmpDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "abcdef");
    const t = track.create({ title: "Fonoteca", file }, 1);

    const res = await request(makeApp())
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie);

    expect(res.status).to.equal(200);
    expect(res.headers["content-type"]).to.equal("audio/flac");
    expect(res.headers["content-length"]).to.equal("6");
    expect(res.headers["accept-ranges"]).to.equal("bytes");
  });

  it("supports range requests", async () => {
    const file = "Artist/Album/12 - Fonoteca #1.flac";
    const absolute = path.join(tmpDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "abcdef");
    const t = track.create({ title: "Fonoteca", file }, 2);

    const res = await request(makeApp())
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie)
      .set("Range", "bytes=0-2");

    expect(res.status).to.equal(206);
    expect(res.headers["content-range"]).to.equal("bytes 0-2/6");
    expect(res.headers["content-length"]).to.equal("3");
  });

  it("does not serve files outside MUSIC_DIR", async () => {
    const t = track.create({ title: "Escape", file: "../escape.flac" }, 3);
    const res = await request(makeApp())
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie);

    expect(res.status).to.equal(403);
  });
});
