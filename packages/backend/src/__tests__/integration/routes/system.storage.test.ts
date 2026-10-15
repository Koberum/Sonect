import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import os from "os";
import path from "path";
import express from "express";
import request from "supertest";
import { errorHandler } from "@middleware/errorHandler";
import systemRoutes from "@routes/systemRoutes";
import { createTestDb } from "@tests/helpers/db.js";
import { storageDb } from "@repo/db";
import {
  initializeServices,
  isServicesInitialized,
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

  it("POST /system/storage/sources/:id/refresh-stats recomputes stats", async () => {
    const sourcePath = path.join(tmpDir, "Refresh");
    fs.mkdirSync(sourcePath, { recursive: true });
    writeAudio(path.join(sourcePath, "one.mp3"), "12345");
    const id = storageDb.create({
      name: "Refresh",
      path: sourcePath,
      enabled: true,
    });

    const res = await request(makeApp()).post(
      `/system/storage/sources/${id}/refresh-stats`,
    );
    expect(res.status).to.equal(200);
    expect(res.body.file_count).to.equal(1);
    expect(res.body.total_size).to.equal(5);
    expect(storageDb.getById(id)?.file_count).to.equal(1);
  });

  it("POST /system/storage/sources/:id/refresh-stats 404s for unknown id", async () => {
    const res = await request(makeApp()).post(
      "/system/storage/sources/99999/refresh-stats",
    );
    expect(res.status).to.equal(404);
  });
});
