import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import os from "os";
import path from "path";
import type * as mm from "music-metadata";
import { createTestDb } from "@tests/helpers/db.js";
import { catalogSyncDb, storageDb, tracksDb } from "@repo/db";
import {
  LibraryScanner,
  mediaMetadata,
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
    scanner = new LibraryScanner(logService);
  });

  afterEach(() => {
    sandbox.restore();
    close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    delete process.env.MUSIC_DIR;
  });

  it("does not re-parse or delete unchanged files", async () => {
    const parseFile = sandbox
      .stub(mediaMetadata, "parseFile")
      .resolves(METADATA);
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
    const parseFile = sandbox
      .stub(mediaMetadata, "parseFile")
      .resolves(METADATA);
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
    sandbox.stub(mediaMetadata, "parseFile").resolves(METADATA);
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
    sandbox.stub(mediaMetadata, "parseFile").resolves(METADATA);
    catalogSyncDb.applyIncremental({ upserts: [], deletions: [] });

    registerSource("readable", "libA");
    writeAudio(path.join("libA", "song.mp3"));
    storageDb.create({
      name: "broken",
      path: path.join(tmpDir, "libB-missing"),
      enabled: true,
    });
    tracksDb.upsert({ file: path.join("libA", "old.mp3"), title: "oldA" });
    tracksDb.upsert({
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

  it("deletes nothing when there are zero enabled sources", async () => {
    sandbox.stub(mediaMetadata, "parseFile").resolves(METADATA);
    registerSource("disabled", "lib1", false);
    tracksDb.upsert({ file: "kept.mp3", title: "kept" });

    const result = await scanner.scan();
    expect(result.synced).to.equal(0);
    expect(result.deleted).to.equal(0);
    expect(tracksDb.getFiles()).to.deep.equal(["kept.mp3"]);
  });

  it("drops MPD-only rows on the first run when a source is walked", async () => {
    sandbox.stub(mediaMetadata, "parseFile").resolves(METADATA);
    registerSource("lib1", "lib1");
    writeAudio(path.join("lib1", "a.mp3"));
    tracksDb.upsert({ file: "ghost.mp3", title: "ghost" });

    const result = await scanner.scan();
    expect(result.deleted).to.equal(1);
    expect(tracksDb.getFiles()).to.deep.equal([path.join("lib1", "a.mp3")]);
  });

  it("emits track progress with the total file count", async () => {
    sandbox.stub(mediaMetadata, "parseFile").resolves(METADATA);
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
    sandbox
      .stub(mediaMetadata, "parseFile")
      .rejects(new Error("unsupported codec"));
    registerSource("lib1", "lib1");
    const abs = writeAudio(path.join("lib1", "mystery.mp3"));

    const result = await scanner.scan();
    expect(result.synced).to.equal(1);
    const row = tracksDb.getByFile(path.join("lib1", "mystery.mp3"));
    expect(row).to.not.equal(undefined);
    expect(row?.mtime).to.equal(fs.statSync(abs).mtimeMs);
  });
});
