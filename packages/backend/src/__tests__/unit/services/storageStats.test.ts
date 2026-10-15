import { expect } from "chai";
import fs from "fs";
import os from "os";
import path from "path";
import { walkSourceFiles, walkSource } from "@services/storage/storageStats";

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
