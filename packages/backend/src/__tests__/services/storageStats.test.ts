import { expect } from "chai";
import sinon from "sinon";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dbModule from "@repo/db";

describe("Storage Stats", () => {
  let root: string;
  let getAllStub: sinon.SinonStub;
  let updateStatsStub: sinon.SinonStub;
  let storageStats: any;

  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-stats-"));

    getAllStub = sinon.stub(dbModule.storageDb, "getAll");
    updateStatsStub = sinon.stub(dbModule.storageDb, "updateStats");

    process.env.MUSIC_EXTENSIONS = "mp3,flac";
    storageStats = await import("../../services/storage/storageStats.js");
  });

  afterEach(() => {
    sinon.restore();
    fs.rmSync(root, { recursive: true, force: true });
  });

  describe("walkSource", () => {
    it("should count music files, dirs and total size only", () => {
      const albums = path.join(root, "albums");
      fs.mkdirSync(albums, { recursive: true });
      fs.writeFileSync(
        path.join(root, "a.mp3"),
        new Array(1000).fill("0").join(""),
      );
      fs.writeFileSync(path.join(root, "b.flac"), "12345");
      fs.writeFileSync(path.join(root, "cover.jpg"), "jpg");
      fs.writeFileSync(path.join(albums, "c.mp3"), "ffffff");
      fs.writeFileSync(path.join(albums, "notes.txt"), "no");

      const exts: ReadonlySet<string> = new Set(["mp3", "flac"]);
      const stats = storageStats.walkSource(root, exts);

      expect(stats.file_count).to.equal(3);
      expect(stats.dir_count).to.equal(1);
      expect(stats.total_size).to.equal(1000 + 5 + 6);
    });

    it("should skip internal symlinks to avoid loops", () => {
      const outside = fs.mkdtempSync(
        path.join(os.tmpdir(), "sonect-stats-out-"),
      );
      fs.writeFileSync(path.join(outside, "x.mp3"), "123");
      fs.symlinkSync(outside, path.join(root, "loop"));
      fs.writeFileSync(path.join(root, "y.mp3"), "ab");

      const stats = storageStats.walkSource(root, new Set(["mp3"]));

      expect(stats.file_count).to.equal(1);
      fs.rmSync(outside, { recursive: true, force: true });
    });

    it("should throw when the root is unreadable", () => {
      try {
        storageStats.walkSource(path.join(root, "missing"), new Set(["mp3"]));
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).to.include("read");
      }
    });
  });

  describe("scanStorageStats", () => {
    it("should persist stats for reachable sources and skip unreachable ones", () => {
      getAllStub.returns([
        { id: 1, name: "a", mount_path: root },
        { id: 2, name: "b", mount_path: path.join(root, "missing") },
      ]);
      fs.writeFileSync(path.join(root, "s.mp3"), "123456");

      storageStats.scanStorageStats();

      expect(updateStatsStub.callCount).to.equal(1);
      expect(
        updateStatsStub.calledWith(1, {
          file_count: 1,
          dir_count: 0,
          total_size: 6,
        }),
      ).to.be.true;
      expect(updateStatsStub.calledWith(2, sinon.match.any)).to.be.false;
    });

    it("should read the extension list from MUSIC_EXTENSIONS at each run", () => {
      process.env.MUSIC_EXTENSIONS = "wav";
      getAllStub.returns([{ id: 1, name: "a", mount_path: root }]);
      fs.writeFileSync(path.join(root, "s.mp3"), "123456");

      storageStats.scanStorageStats();

      const args = updateStatsStub.getCall(0).args[1];
      expect(args.file_count).to.equal(0);
    });
  });
});
