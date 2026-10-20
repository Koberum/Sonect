import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import request from "supertest";
import { errorHandler } from "@middleware/errorHandler";
import systemRoutes from "@routes/systemRoutes";
import { computeSourceStatsWithinBudget } from "@services/storage/storageService.js";
import { createTestDb } from "@tests/helpers/db.js";
import { db, storageDb, upsertTrack } from "@repo/db";
import {
  initializeServices,
  isServicesInitialized,
  getStorageService,
  getMpdConnectionManager,
  getCatalogSyncOrchestrator,
} from "@services/factory.js";

describe("system storage routes", () => {
  let close: () => void;
  let sandbox: sinon.SinonSandbox;
  let tmpDir: string;

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use("/system", systemRoutes);
    app.use(errorHandler);
    return app;
  }

  function writeAudio(abs: string, content: string): void {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });

  beforeEach(() => {
    ({ close } = createTestDb());
    sandbox = sinon.createSandbox();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-detected-"));
    process.env.MUSIC_DIR = tmpDir;
  });

  afterEach(() => {
    sandbox.restore();
    close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.MUSIC_DIR;
  });

  it("GET /system/storage/detected flags registered and mounted dirs", async () => {
    const registeredPath = path.join(tmpDir, "Registered");
    const mountedPath = path.join(tmpDir, "Mounted");
    fs.mkdirSync(path.join(registeredPath, "sub"), { recursive: true });
    fs.mkdirSync(mountedPath, { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "Plain"), { recursive: true });
    // Non-directory entries must not be suggested.
    fs.writeFileSync(path.join(tmpDir, "notadir.txt"), "x");
    writeAudio(path.join(registeredPath, "a.mp3"), "aaaa");
    writeAudio(path.join(registeredPath, "b.flac"), "bbbbbb");

    storageDb.create({
      name: "Registered",
      path: registeredPath,
      enabled: true,
    });

    const originalReadFileSync = fs.readFileSync;
    sandbox.stub(fs, "readFileSync").callsFake(((
      p: fs.PathOrFileDescriptor,
      ...args: unknown[]
    ) => {
      if (String(p) === "/proc/mounts") {
        return `overlay ${mountedPath} ext4 rw 0 0\n`;
      }
      return (originalReadFileSync as (...a: unknown[]) => unknown)(p, ...args);
    }) as typeof fs.readFileSync);

    const res = await request(makeApp()).get("/system/storage/detected");
    expect(res.status).to.equal(200);

    const libs = res.body as Array<{
      name: string;
      isMount: boolean;
      registered: boolean;
      stats?: { file_count: number; dir_count: number; total_size: number };
    }>;
    const byName = Object.fromEntries(libs.map((l) => [l.name, l]));
    expect(Object.keys(byName).sort()).to.deep.equal([
      "Mounted",
      "Plain",
      "Registered",
    ]);
    expect(byName.Registered).to.include({
      isMount: false,
      registered: true,
    });
    expect(byName.Mounted).to.include({ isMount: true, registered: false });
    expect(byName.Plain).to.include({ isMount: false, registered: false });
    expect(byName.Registered.stats).to.deep.equal({
      file_count: 2,
      dir_count: 1,
      total_size: 10,
    });
  });

  it("POST /system/storage/sources/:id/refresh-stats uses the catalog file count", async () => {
    const sourcePath = path.join(tmpDir, "Refresh");
    fs.mkdirSync(sourcePath, { recursive: true });
    writeAudio(path.join(sourcePath, "one.mp3"), "12345");
    writeAudio(path.join(sourcePath, "two.mp3"), "123");
    const id = storageDb.create({
      name: "Refresh",
      path: sourcePath,
      enabled: true,
    });
    upsertTrack(db(), {
      file: "Refresh/one.mp3",
      title: "One",
      storageSourceId: id,
    });

    const res = await request(makeApp()).post(
      `/system/storage/sources/${id}/refresh-stats`,
    );
    expect(res.status).to.equal(200);
    expect(res.body.file_count).to.equal(1);
    expect(res.body.total_size).to.equal(8);
    expect(storageDb.getById(id)?.file_count).to.equal(1);
  });

  it("POST /system/storage/sources/:id/refresh-stats 404s for unknown id", async () => {
    const res = await request(makeApp()).post(
      "/system/storage/sources/99999/refresh-stats",
    );
    expect(res.status).to.equal(404);
  });

  it("POST /system/storage/sources/:id/refresh-stats 400s on unreadable path", async () => {
    const missingPath = path.join(tmpDir, "does-not-exist");
    const id = storageDb.create({
      name: "Missing",
      path: missingPath,
      enabled: true,
    });

    const res = await request(makeApp()).post(
      `/system/storage/sources/${id}/refresh-stats`,
    );
    expect(res.status).to.equal(400);
    expect(res.body.error).to.include("Cannot read library path");
    // Stats must not be touched on failure.
    expect(storageDb.getById(id)?.file_count).to.equal(0);
  });

  describe("GET /system/storage/stats", () => {
    it("returns stats for a first-level folder", async () => {
      const libPath = path.join(tmpDir, "StatsLib");
      writeAudio(path.join(libPath, "a.mp3"), "aa");
      writeAudio(path.join(libPath, "nested", "b.flac"), "bbb");

      const res = await request(makeApp())
        .get("/system/storage/stats")
        .query({ path: libPath });
      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal({
        file_count: 2,
        dir_count: 1,
        total_size: 5,
      });
    });

    it("400s when the path query parameter is missing", async () => {
      const res = await request(makeApp()).get("/system/storage/stats");
      expect(res.status).to.equal(400);
    });

    it("400s for a path outside MUSIC_DIR", async () => {
      const res = await request(makeApp())
        .get("/system/storage/stats")
        .query({ path: "/etc" });
      expect(res.status).to.equal(400);
    });

    it("400s for a nested path", async () => {
      const libPath = path.join(tmpDir, "Nested");
      fs.mkdirSync(path.join(libPath, "sub"), { recursive: true });
      const res = await request(makeApp())
        .get("/system/storage/stats")
        .query({ path: path.join(libPath, "sub") });
      expect(res.status).to.equal(400);
    });

    it("400s for a non-existent folder", async () => {
      const res = await request(makeApp())
        .get("/system/storage/stats")
        .query({ path: path.join(tmpDir, "ghost") });
      expect(res.status).to.equal(400);
    });

    it("400s when the folder cannot be read", async () => {
      const libPath = path.join(tmpDir, "Unreadable");
      writeAudio(path.join(libPath, "a.mp3"), "aa");
      sandbox
        .stub(fs.promises, "readdir")
        .rejects(new Error("EACCES: permission denied"));

      const res = await request(makeApp())
        .get("/system/storage/stats")
        .query({ path: libPath });
      expect(res.status).to.equal(400);
      expect(res.body.error).to.include("Cannot read library path");
    });

    it("400s for a symlink that points outside MUSIC_DIR", async () => {
      const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-outside-"));
      fs.writeFileSync(path.join(outside, "a.mp3"), "aa");
      fs.symlinkSync(outside, path.join(tmpDir, "linked"), "dir");

      try {
        const res = await request(makeApp())
          .get("/system/storage/stats")
          .query({ path: path.join(tmpDir, "linked") });
        expect(res.status).to.equal(400);
      } finally {
        fs.rmSync(outside, { recursive: true, force: true });
      }
    });

    it("keeps computed stats in /storage/detected when the bounded walk omits them", async () => {
      const libPath = path.join(tmpDir, "BigLib");
      writeAudio(path.join(libPath, "a.mp3"), "aaaaa");

      const statsRes = await request(makeApp())
        .get("/system/storage/stats")
        .query({ path: libPath });
      expect(statsRes.status).to.equal(200);

      // Simulate the 20k-file budget cutting in for this folder.
      const service = getStorageService() as unknown as {
        computeBoundedStats: (root: string) => unknown;
      };
      sandbox.stub(service, "computeBoundedStats").returns(undefined);

      const res = await request(makeApp()).get("/system/storage/detected");
      const lib = (res.body as Array<{ name: string; stats?: unknown }>).find(
        (l) => l.name === "BigLib",
      );
      expect(lib?.stats).to.deep.equal({
        file_count: 1,
        dir_count: 0,
        total_size: 5,
      });
    });
  });

  it("POST /system/storage/sources persists eager stats", async () => {
    sandbox.stub(getMpdConnectionManager(), "executeCommand").resolves();
    sandbox.stub(getCatalogSyncOrchestrator(), "scanLibrary").resolves();

    const libPath = path.join(tmpDir, "NewLib");
    writeAudio(path.join(libPath, "one.mp3"), "12345");

    const res = await request(makeApp())
      .post("/system/storage/sources")
      .send({ name: "NewLib", path: libPath });
    expect(res.status).to.equal(201);
    expect(res.body.file_count).to.equal(1);
    expect(res.body.total_size).to.equal(5);

    const id = res.body.id as number;
    expect(storageDb.getById(id)?.file_count).to.equal(1);
    expect(storageDb.getById(id)?.total_size).to.equal(5);
  });

  describe("computeSourceStatsWithinBudget", () => {
    it("counts audio files when at or under the cap", () => {
      const root = path.join(tmpDir, "Budget");
      fs.mkdirSync(path.join(root, "nested"), { recursive: true });
      writeAudio(path.join(root, "a.mp3"), "aa");
      writeAudio(path.join(root, "nested", "b.flac"), "bbb");
      fs.writeFileSync(path.join(root, "ignore.txt"), "x");

      expect(computeSourceStatsWithinBudget(root, 5)).to.deep.equal({
        file_count: 2,
        dir_count: 1,
        total_size: 5,
      });
    });

    it("returns undefined once the file count exceeds the cap", () => {
      const root = path.join(tmpDir, "Over");
      fs.mkdirSync(root, { recursive: true });
      writeAudio(path.join(root, "a.mp3"), "a");
      writeAudio(path.join(root, "b.mp3"), "b");
      writeAudio(path.join(root, "c.mp3"), "c");

      expect(computeSourceStatsWithinBudget(root, 2)).to.be.undefined;
      expect(computeSourceStatsWithinBudget(root, 3)).to.deep.equal({
        file_count: 3,
        dir_count: 0,
        total_size: 3,
      });
    });

    it("skips an unreadable subdirectory instead of failing the walk", () => {
      const root = path.join(tmpDir, "Partial");
      const locked = path.join(root, "locked");
      fs.mkdirSync(locked, { recursive: true });
      writeAudio(path.join(root, "a.mp3"), "aa");
      writeAudio(path.join(locked, "hidden.mp3"), "bbbb");

      const realReaddir = fs.readdirSync;
      sandbox.stub(fs, "readdirSync").callsFake(((
        dir: fs.PathLike,
        options?: unknown,
      ) => {
        if (String(dir) === locked) {
          const err = new Error(
            "EACCES: permission denied",
          ) as NodeJS.ErrnoException;
          err.code = "EACCES";
          throw err;
        }
        return (realReaddir as (d: fs.PathLike, o?: unknown) => unknown)(
          dir,
          options,
        );
      }) as typeof fs.readdirSync);

      expect(computeSourceStatsWithinBudget(root, 10)).to.deep.equal({
        file_count: 1,
        dir_count: 1,
        total_size: 2,
      });
    });
  });
});
