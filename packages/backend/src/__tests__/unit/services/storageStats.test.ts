import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";
import {
  walkSourceFiles,
  walkSource,
  computeSourceStats,
  computeSourceStatsAsync,
} from "@services/storage/storageStats";

describe("walkSourceFiles", () => {
  it("returns audio files with mtime and size, skipping non-audio and symlinks", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-"));
    fs.mkdirSync(path.join(root, "sub"));
    fs.writeFileSync(path.join(root, "a.mp3"), "12345");
    fs.writeFileSync(path.join(root, "sub", "b.flac"), "1234567890");
    fs.writeFileSync(path.join(root, "cover.jpg"), "x");
    const exts = new Set(["mp3", "flac"]);
    const files = walkSourceFiles(root, exts);
    expect(files.map((f) => f.file).sort()).to.deep.equal([
      "a.mp3",
      path.join("sub", "b.flac"),
    ]);
    expect(files.find((f) => f.file === "a.mp3")?.size).to.equal(5);
    expect(files.every((f) => typeof f.mtimeMs === "number")).to.equal(true);
    const stats = walkSource(root, exts);
    expect(stats).to.deep.equal({
      file_count: 2,
      dir_count: 1,
      total_size: 15,
    });
  });
});

describe("computeSourceStatsAsync", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-async-stats-"));
    fs.mkdirSync(path.join(root, "nested"));
    fs.writeFileSync(path.join(root, "a.mp3"), "aa");
    fs.writeFileSync(path.join(root, "nested", "b.flac"), "bbb");
    fs.writeFileSync(path.join(root, "ignore.txt"), "x");
    fs.mkdirSync(path.join(root, "real-dir"));
    fs.symlinkSync(
      path.join(root, "real-dir"),
      path.join(root, "linked-dir"),
      "dir",
    );
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("matches the sync walk on a mixed tree", async () => {
    expect(await computeSourceStatsAsync(root)).to.deep.equal(
      computeSourceStats(root),
    );
    expect(await computeSourceStatsAsync(root)).to.deep.equal({
      file_count: 2,
      dir_count: 2,
      total_size: 5,
    });
  });

  it("rejects when the root is missing", async () => {
    const missing = path.join(root, "does-not-exist");
    let caught: unknown;
    try {
      await computeSourceStatsAsync(missing);
    } catch (err) {
      caught = err;
    }
    expect(caught).to.be.instanceOf(Error);
    expect((caught as Error).message).to.match(/Cannot read directory/);
  });
});
