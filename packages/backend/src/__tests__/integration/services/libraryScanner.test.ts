import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import os from "os";
import path from "path";
import { eq } from "drizzle-orm";
import type * as mm from "music-metadata";
import { createTestDb } from "@tests/helpers/db.js";
import {
  catalogSyncDb,
  db,
  storageDb,
  tracks,
  tracksDb,
  upsertTrack,
} from "@repo/db";
import {
  LibraryScanner,
  type ScanProgress,
} from "@services/library/libraryScanner.js";
import type { LogService } from "@services/utils/logService";

const METADATA = {
  common: {
    title: "Title",
    artist: "Artist",
    album: "Album",
    genre: ["Genre"],
    track: { no: 1 },
    disk: { no: 1 },
    date: "2024",
  },
  format: { duration: 123.4 },
} as unknown as mm.IAudioMetadata;

describe("LibraryScanner (integration)", () => {
  let close: () => void;
  let sandbox: sinon.SinonSandbox;
  let tmpDir: string;
  let parseFile: sinon.SinonStub;
  let scanner: LibraryScanner;

  function writeAudio(rel: string, content = "x"): string {
    const abs = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    return abs;
  }

  function registerSource(
    name: string,
    relDir: string,
    enabled = true,
  ): number {
    const sourcePath = path.join(tmpDir, relDir);
    fs.mkdirSync(sourcePath, { recursive: true });
    return storageDb.create({ name, path: sourcePath, enabled });
  }

  beforeEach(() => {
    ({ close } = createTestDb());
    sandbox = sinon.createSandbox();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-scan-"));
    process.env.MUSIC_DIR = tmpDir;
    const logService = {
      pushLog: sandbox.stub(),
    } as unknown as LogService;
    parseFile = sandbox.stub().resolves(METADATA);
    scanner = new LibraryScanner(logService, parseFile);
  });

  afterEach(() => {
    sandbox.restore();
    close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.MUSIC_DIR;
  });

  it("does not re-parse or delete unchanged files", async () => {
    registerSource("lib1", "lib1");
    writeAudio(path.join("lib1", "a.mp3"));
    writeAudio(path.join("lib1", "b.mp3"));

    const first = await scanner.scan();
    expect(first.synced).to.equal(2);
    expect(first.deleted).to.equal(0);
    expect(parseFile.callCount).to.equal(2);
    expect(tracksDb.getFiles().sort()).to.deep.equal([
      path.join("lib1", "a.mp3"),
      path.join("lib1", "b.mp3"),
    ]);

    const second = await scanner.scan();
    expect(second.synced).to.equal(0);
    expect(second.deleted).to.equal(0);
    expect(parseFile.callCount).to.equal(2);
  });

  it("re-parses a file whose size/mtime changed", async () => {
    registerSource("lib1", "lib1");
    const abs = writeAudio(path.join("lib1", "a.mp3"), "12345");

    await scanner.scan();
    expect(parseFile.callCount).to.equal(1);

    fs.writeFileSync(abs, "1234567890");
    const future = new Date(Date.now() + 5_000);
    fs.utimesSync(abs, future, future);

    const result = await scanner.scan();
    expect(result.synced).to.equal(1);
    expect(parseFile.callCount).to.equal(2);
  });

  it("deletes a track removed from a readable source", async () => {
    registerSource("lib1", "lib1");
    writeAudio(path.join("lib1", "a.mp3"));
    const removed = writeAudio(path.join("lib1", "b.mp3"));

    await scanner.scan();
    expect(tracksDb.getFiles()).to.have.length(2);

    fs.rmSync(removed);
    const result = await scanner.scan();
    expect(result.deleted).to.equal(1);
    expect(tracksDb.getFiles()).to.deep.equal([path.join("lib1", "a.mp3")]);
  });

  it("keeps rows of an unreadable source", async () => {
    catalogSyncDb.applyIncremental({ upserts: [], deletions: [] });

    registerSource("readable", "libA");
    writeAudio(path.join("libA", "song.mp3"));
    storageDb.create({
      name: "broken",
      path: path.join(tmpDir, "libB-missing"),
      enabled: true,
    });
    upsertTrack(db(), { file: path.join("libA", "old.mp3"), title: "oldA" });
    upsertTrack(db(), {
      file: path.join("libB-missing", "song.mp3"),
      title: "underB",
    });

    const result = await scanner.scan();
    const files = tracksDb.getFiles();

    expect(result.deleted).to.equal(1);
    expect(files).to.include(path.join("libB-missing", "song.mp3"));
    expect(files).to.include(path.join("libA", "song.mp3"));
    expect(files).to.not.include(path.join("libA", "old.mp3"));
  });

  it("first run never deletes rows under an unreadable or disabled source", async () => {
    registerSource("readable", "libA");
    writeAudio(path.join("libA", "song.mp3"));
    storageDb.create({
      name: "broken",
      path: path.join(tmpDir, "libB-missing"),
      enabled: true,
    });

    upsertTrack(db(), { file: path.join("libA", "old.mp3"), title: "oldA" });
    upsertTrack(db(), {
      file: path.join("libB-missing", "song.mp3"),
      title: "underB",
    });
    upsertTrack(db(), { file: "orphan.mp3", title: "orphan" });

    const result = await scanner.scan();
    const files = tracksDb.getFiles();

    expect(result.deleted).to.equal(2);
    expect(files).to.include(path.join("libB-missing", "song.mp3"));
    expect(files).to.include(path.join("libA", "song.mp3"));
    expect(files).to.not.include(path.join("libA", "old.mp3"));
    expect(files).to.not.include("orphan.mp3");
  });

  it("deletes nothing when there are zero enabled sources", async () => {
    registerSource("disabled", "lib1", false);
    upsertTrack(db(), { file: "kept.mp3", title: "kept" });

    const result = await scanner.scan();
    expect(result.synced).to.equal(0);
    expect(result.deleted).to.equal(0);
    expect(tracksDb.getFiles()).to.deep.equal(["kept.mp3"]);
  });

  it("does not spend the first-run marker when nothing is walked", async () => {
    storageDb.create({
      name: "broken",
      path: path.join(tmpDir, "missing"),
      enabled: true,
    });
    upsertTrack(db(), { file: "legacy.mp3", title: "legacy" });

    const result = await scanner.scan();

    expect(result).to.deep.equal({ synced: 0, deleted: 0, errors: 0 });
    expect(catalogSyncDb.getScannerVersion()).to.equal(undefined);
    expect(tracksDb.getFiles()).to.deep.equal(["legacy.mp3"]);
  });

  it("drops MPD-only rows on the first run when a source is walked", async () => {
    registerSource("lib1", "lib1");
    writeAudio(path.join("lib1", "a.mp3"));
    upsertTrack(db(), { file: "ghost.mp3", title: "ghost" });

    const result = await scanner.scan();
    expect(result.deleted).to.equal(1);
    expect(tracksDb.getFiles()).to.deep.equal([path.join("lib1", "a.mp3")]);
  });

  it("preserves play_count and last_played for present files", async () => {
    registerSource("lib1", "lib1");
    const abs = writeAudio(path.join("lib1", "a.mp3"), "12345");
    const rel = path.join("lib1", "a.mp3");

    await scanner.scan();
    db()
      .update(tracks)
      .set({ play_count: 42, last_played: "2024-01-01 00:00:00" })
      .where(eq(tracks.file, rel))
      .run();

    await scanner.scan();
    let row = tracksDb.getByFile(rel);
    expect(row?.play_count).to.equal(42);
    expect(row?.last_played).to.equal("2024-01-01 00:00:00");

    fs.writeFileSync(abs, "1234567890");
    const future = new Date(Date.now() + 5_000);
    fs.utimesSync(abs, future, future);

    await scanner.scan();
    row = tracksDb.getByFile(rel);
    expect(row?.play_count).to.equal(42);
    expect(row?.last_played).to.equal("2024-01-01 00:00:00");
  });

  it("emits track progress with the total file count", async () => {
    registerSource("lib1", "lib1");
    writeAudio(path.join("lib1", "a.mp3"));
    writeAudio(path.join("lib1", "b.mp3"));

    const progress: ScanProgress[] = [];
    await scanner.scan((p) => progress.push(p));

    expect(progress).to.deep.equal([
      { phase: "tracks", current: 1, total: 2 },
      { phase: "tracks", current: 2, total: 2 },
    ]);
  });

  it("still indexes a file when metadata parsing fails", async () => {
    parseFile.rejects(new Error("unsupported codec"));
    registerSource("lib1", "lib1");
    const abs = writeAudio(path.join("lib1", "mystery.mp3"));

    const result = await scanner.scan();
    expect(result.synced).to.equal(1);
    const row = tracksDb.getByFile(path.join("lib1", "mystery.mp3"));
    expect(row).to.not.equal(undefined);
    expect(row?.mtime).to.equal(fs.statSync(abs).mtimeMs);
  });
});
