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

  it("supports suffix range requests", async () => {
    const file = "Artist/Album/suffix.flac";
    const absolute = path.join(tmpDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "abcdef");
    const t = track.create({ title: "Suffix", file }, 4);

    const res = await request(makeApp())
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie)
      .set("Range", "bytes=-3");

    expect(res.status).to.equal(206);
    expect(res.headers["content-range"]).to.equal("bytes 3-5/6");
    expect(res.headers["content-length"]).to.equal("3");
  });

  it("supports open-ended range requests", async () => {
    const file = "Artist/Album/open.flac";
    const absolute = path.join(tmpDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "abcdef");
    const t = track.create({ title: "Open", file }, 5);

    const res = await request(makeApp())
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie)
      .set("Range", "bytes=3-");

    expect(res.status).to.equal(206);
    expect(res.headers["content-range"]).to.equal("bytes 3-5/6");
    expect(res.headers["content-length"]).to.equal("3");
  });

  it("rejects unsatisfiable and malformed ranges", async () => {
    const file = "Artist/Album/bad-range.flac";
    const absolute = path.join(tmpDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "abcdef");
    const t = track.create({ title: "BadRange", file }, 6);
    const app = makeApp();

    const unsatisfiable = await request(app)
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie)
      .set("Range", "bytes=99-100");
    expect(unsatisfiable.status).to.equal(416);
    expect(unsatisfiable.headers["content-range"]).to.equal("bytes */6");

    const malformed = await request(app)
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie)
      .set("Range", "bytes=abc");
    expect(malformed.status).to.equal(416);
  });

  it("answers HEAD without streaming a body", async () => {
    const file = "Artist/Album/head.flac";
    const absolute = path.join(tmpDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "abcdef");
    const t = track.create({ title: "Head", file }, 7);

    const res = await request(makeApp())
      .head(`/stream/${t.id}`)
      .set("Cookie", cookie);

    expect(res.status).to.equal(200);
    expect(res.headers["content-length"]).to.equal("6");
    expect(res.headers["accept-ranges"]).to.equal("bytes");
  });

  it("sets validators and private caching headers", async () => {
    const file = "Artist/Album/cache.flac";
    const absolute = path.join(tmpDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "abcdef");
    const t = track.create({ title: "Cache", file }, 8);

    const res = await request(makeApp())
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie);

    expect(res.status).to.equal(200);
    expect(res.headers.etag).to.be.a("string");
    expect(res.headers["last-modified"]).to.be.a("string");
    expect(res.headers["cache-control"]).to.equal("private, max-age=3600");
  });

  it("ignores Range when If-Range does not match", async () => {
    const file = "Artist/Album/if-range.flac";
    const absolute = path.join(tmpDir, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, "abcdef");
    const t = track.create({ title: "IfRange", file }, 9);

    const res = await request(makeApp())
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie)
      .set("Range", "bytes=0-2")
      .set("If-Range", '"stale"');

    expect(res.status).to.equal(200);
    expect(res.headers["content-length"]).to.equal("6");
  });

  it("does not serve files outside MUSIC_DIR", async () => {
    const t = track.create({ title: "Escape", file: "../escape.flac" }, 3);
    const res = await request(makeApp())
      .get(`/stream/${t.id}`)
      .set("Cookie", cookie);

    expect(res.status).to.equal(403);
  });
});
