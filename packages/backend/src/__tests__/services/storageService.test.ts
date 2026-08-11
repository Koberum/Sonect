import { expect } from "chai";
import sinon from "sinon";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import childProcess from "child_process";
import * as dbModule from "@repo/db";
import { mpdConnectionManager } from "../../services/mpdConnectionManager";

describe("Storage Service (local sources)", () => {
  let musicDir: string;
  let targetDir: string;
  let storageService: any;
  let execSyncStub: sinon.SinonStub;
  let executeCommandStub: sinon.SinonStub;
  let createStub: sinon.SinonStub;
  let getByIdStub: sinon.SinonStub;
  let deleteStub: sinon.SinonStub;
  let updateStub: sinon.SinonStub;
  let getAllStub: sinon.SinonStub;

  const localSource = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    name: "My Local",
    type: "local",
    uri: "",
    mount_path: "",
    enabled: 1,
    createdAt: undefined,
    ...overrides,
  });

  beforeEach(async () => {
    musicDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-music-"));
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonect-target-"));
    fs.writeFileSync(path.join(targetDir, "a.mp3"), "123");
    process.env.MUSIC_DIR = musicDir;
    process.env.MPD_CONFIG_PATH = path.join(musicDir, "mpd-audio.conf");

    execSyncStub = sinon.stub(childProcess, "execSync").returns("");
    executeCommandStub = sinon
      .stub(mpdConnectionManager, "executeCommand")
      .resolves("");

    createStub = sinon.stub(dbModule.storageDb, "create");
    getByIdStub = sinon.stub(dbModule.storageDb, "getById");
    deleteStub = sinon.stub(dbModule.storageDb, "delete");
    updateStub = sinon.stub(dbModule.storageDb, "update");
    getAllStub = sinon.stub(dbModule.storageDb, "getAll");

    storageService = await import("../../services/storageService.ts");
    sinon.stub(storageService.storageHooks, "scanLibrary").resolves(undefined);
    sinon
      .stub(storageService.storageHooks, "ensureSymlinksAllowed")
      .returns({ success: true });
  });

  afterEach(() => {
    sinon.restore();
    fs.rmSync(musicDir, { recursive: true, force: true });
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  describe("createStorageSource (local)", () => {
    it("should create a symlink under MUSIC_DIR and trigger a scan", async () => {
      const source = localSource({
        uri: targetDir,
        mount_path: path.join(musicDir, "my-music"),
      });
      createStub.returns(1);
      getByIdStub.returns(source);

      const result = storageService.createStorageSource({
        name: "My Local",
        type: "local",
        uri: targetDir,
        mount_path: "my-music",
      });

      expect(createStub.calledOnce).to.be.true;
      expect(result.mount_path).to.equal(path.join(musicDir, "my-music"));
      const linkStats = fs.lstatSync(path.join(musicDir, "my-music"));
      expect(linkStats.isSymbolicLink()).to.be.true;
      expect(fs.readlinkSync(path.join(musicDir, "my-music"))).to.equal(
        targetDir,
      );
      expect(storageService.storageHooks.ensureSymlinksAllowed.calledOnce).to.be
        .true;
      expect(storageService.storageHooks.scanLibrary.calledOnce).to.be.true;
      expect(executeCommandStub.calledWith("update")).to.be.true;
    });

    it("should reject a local uri that does not exist", () => {
      const missing = path.join(targetDir, "nope");
      createStub.returns(1);
      getByIdStub.returns(
        localSource({ uri: missing, mount_path: path.join(musicDir, "x") }),
      );

      try {
        storageService.createStorageSource({
          name: "Bad",
          type: "local",
          uri: missing,
          mount_path: "x",
        });
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.name).to.equal("ValidationError");
        expect(err.message).to.include("does not exist");
        expect(createStub.calledOnce).to.be.false;
      }
    });

    it("should reject a local uri inside MUSIC_DIR", () => {
      try {
        storageService.createStorageSource({
          name: "Bad",
          type: "local",
          uri: musicDir,
          mount_path: "x",
        });
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.name).to.equal("ValidationError");
        expect(err.message).to.include("outside the music directory");
      }
    });
  });

  describe("deleteStorageSource", () => {
    it("should remove the local symlink and delete the row", () => {
      fs.symlinkSync(targetDir, path.join(musicDir, "my-music"));
      getByIdStub.returns(
        localSource({
          uri: targetDir,
          mount_path: path.join(musicDir, "my-music"),
          id: 7,
        }),
      );

      const result = storageService.deleteStorageSource(7);

      expect(result).to.be.true;
      expect(fs.existsSync(path.join(musicDir, "my-music"))).to.be.false;
      expect(deleteStub.calledWith(7)).to.be.true;
    });
  });

  describe("updateStorageSource", () => {
    it("should re-point the symlink when the mount path changes", () => {
      const before = localSource({
        uri: targetDir,
        mount_path: path.join(musicDir, "old-name"),
      });
      const after = localSource({
        uri: targetDir,
        mount_path: path.join(musicDir, "new-name"),
      });
      getByIdStub.onCall(0).returns(before);
      getByIdStub.onCall(1).returns(after);
      fs.symlinkSync(targetDir, before.mount_path);

      storageService.updateStorageSource(1, { mount_path: "new-name" });

      expect(fs.existsSync(before.mount_path)).to.be.false;
      expect(fs.readlinkSync(after.mount_path)).to.equal(targetDir);
      expect(updateStub.calledOnce).to.be.true;
    });
  });
});
