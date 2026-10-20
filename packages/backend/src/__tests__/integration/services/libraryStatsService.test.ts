import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import os from "os";
import path from "path";
import { createTestDb } from "@tests/helpers/db.js";
import { db, storageDb, upsertTrack } from "@repo/db";
import { LibraryStatsServiceImpl } from "@services/storage/libraryStatsService.js";
import type { LogService } from "@services/utils/logService";

describe("LibraryStatsService (integration)", () => {
  let close: () => void;
  let sandbox: sinon.SinonSandbox;
  let musicDir: string;
  let logService: LogService;
  let originalMusicDir: string | undefined;

  beforeEach(() => {
    ({ close } = createTestDb());
    sandbox = sinon.createSandbox();
    musicDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-library-stats-"));
    originalMusicDir = process.env.MUSIC_DIR;
    process.env.MUSIC_DIR = musicDir;
    logService = { pushLog: sandbox.stub() } as unknown as LogService;
  });

  afterEach(() => {
    sandbox.restore();
    close();
    fs.rmSync(musicDir, { recursive: true, force: true });
    if (originalMusicDir === undefined) delete process.env.MUSIC_DIR;
    else process.env.MUSIC_DIR = originalMusicDir;
  });

  function writeAudio(relativePath: string, content: string): void {
    const file = path.join(musicDir, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }

  function createSource(name: string, relativePath: string): number {
    const sourcePath = path.join(musicDir, relativePath);
    fs.mkdirSync(sourcePath, { recursive: true });
    return storageDb.create({ name, path: sourcePath, enabled: true });
  }

  it("updates only the requested source and takes file_count from the catalog", async () => {
    const sourceId = createSource("Lib", "lib");
    writeAudio("lib/a.mp3", "12345");
    writeAudio("lib/sub/b.mp3", "1234567890");
    upsertTrack(db(), {
      file: "lib/a.mp3",
      title: "A",
      artist: "Artist",
      album: "Album",
      storageSourceId: sourceId,
    });

    const otherId = createSource("Other", "other");
    storageDb.updateStats(otherId, {
      file_count: 99,
      dir_count: 9,
      total_size: 999,
    });

    const service = new LibraryStatsServiceImpl(logService);
    await service.refresh([sourceId]);

    const row = storageDb.getById(sourceId);
    expect(row?.file_count).to.equal(1);
    expect(row?.dir_count).to.equal(1);
    expect(row?.total_size).to.equal(15);
    expect(storageDb.getById(otherId)?.file_count).to.equal(99);
    expect(storageDb.getById(otherId)?.dir_count).to.equal(9);
    expect(storageDb.getById(otherId)?.total_size).to.equal(999);
  });

  it("keeps stored dirs and size when the path is unreadable", async () => {
    const sourceId = storageDb.create({
      name: "Missing",
      path: path.join(musicDir, "missing"),
      enabled: true,
    });
    upsertTrack(db(), {
      file: "missing/a.mp3",
      title: "A",
      storageSourceId: sourceId,
    });
    storageDb.updateStats(sourceId, {
      file_count: 0,
      dir_count: 5,
      total_size: 100,
    });

    const service = new LibraryStatsServiceImpl(logService);
    await service.refresh([sourceId]);

    const row = storageDb.getById(sourceId);
    expect(row?.file_count).to.equal(1);
    expect(row?.dir_count).to.equal(5);
    expect(row?.total_size).to.equal(100);
  });

  it("returns undefined from refreshOne for an unknown id", async () => {
    const service = new LibraryStatsServiceImpl(logService);
    expect(await service.refreshOne(99999)).to.be.undefined;
  });
});
