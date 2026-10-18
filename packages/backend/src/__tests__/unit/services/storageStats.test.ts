import { expect } from "chai";
import sinon from "sinon";
import fs from "fs";
import os from "os";
import path from "path";
import {
  walk,
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

describe("walk tolerance", () => {
  let sandbox: sinon.SinonSandbox;
  let root: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    root = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-walk-"));
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  /** Build a path whose last component contains raw (non-UTF-8) bytes. */
  function rawEntry(dir: string, name: Buffer): Buffer {
    return Buffer.concat([Buffer.from(dir + path.sep), name]);
  }

  it("skips entries whose names are not valid UTF-8 and reports the parent", () => {
    const album = path.join(root, "album");
    fs.mkdirSync(album, { recursive: true });
    fs.writeFileSync(path.join(album, "ok.mp3"), "x");

    // "2003 - Verità" with a latin-1 0xE0 instead of UTF-8 0xC3 0xA0.
    const badDir = rawEntry(
      album,
      Buffer.from([...Buffer.from("2003 - Verit"), 0xe0]),
    );
    fs.mkdirSync(badDir);
    fs.writeFileSync(
      Buffer.concat([badDir, Buffer.from(path.sep + "inside.mp3")]),
      "x",
    );

    const result = walk(root, new Set(["mp3"]));

    expect(result.files.map((f) => f.file)).to.deep.equal([
      path.join("album", "ok.mp3"),
    ]);
    expect(result.skipped).to.have.length(1);
    expect(result.skipped[0]).to.include({ path: album, reason: "encoding" });
    expect(result.skipped[0].sample).to.contain("2003 - Verit");
  });

  it("skips an unreadable subdirectory and keeps walking", () => {
    fs.writeFileSync(path.join(root, "ok.mp3"), "x");
    const locked = path.join(root, "locked");
    fs.mkdirSync(locked);
    fs.writeFileSync(path.join(locked, "hidden.mp3"), "x");

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

    const result = walk(root, new Set(["mp3"]));

    expect(result.files.map((f) => f.file)).to.deep.equal(["ok.mp3"]);
    expect(result.skipped).to.deep.equal([
      { path: locked, reason: "unreadable", code: "EACCES" },
    ]);
  });

  it("keeps the async stats walk going past a non-UTF-8 directory", async () => {
    fs.mkdirSync(path.join(root, "nested"), { recursive: true });
    fs.writeFileSync(path.join(root, "nested", "ok.mp3"), "12345");

    const badDir = rawEntry(root, Buffer.from([...Buffer.from("Verit"), 0xe0]));
    fs.mkdirSync(badDir);
    fs.writeFileSync(
      Buffer.concat([badDir, Buffer.from(path.sep + "hidden.mp3")]),
      "x",
    );

    const stats = await computeSourceStatsAsync(root);

    expect(stats).to.deep.equal({
      file_count: 1,
      dir_count: 1,
      total_size: 5,
    });
  });
});
