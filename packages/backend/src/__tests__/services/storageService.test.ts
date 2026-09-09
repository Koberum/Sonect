import { expect } from "chai";
import sinon from "sinon";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import childProcess from "child_process";
import * as dbModule from "@repo/db";
import { mpdConnectionManager } from "../../services/utils/mpdConnectionManager";

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
  let setupCompletedStub: sinon.SinonStub;

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
    setupCompletedStub = sinon.stub(dbModule.setupDb, "setCompleted");

    storageService = await import("../../services/storage/storageService");
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
      expect(setupCompletedStub.called).to.be.false;
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

  describe("createStorageSource (network sources)", () => {
    it("should auto-generate a mount segment from the name when mount_path is omitted", () => {
      const source = localSource({
        id: 2,
        type: "smb",
        name: "My NAS",
        uri: "//server/share",
        mount_path: path.join(musicDir, "my-nas"),
      });
      createStub.returns(2);
      getByIdStub.returns(source);
      getAllStub.returns([]);

      const result = storageService.createStorageSource({
        name: "My NAS",
        type: "smb",
        uri: "//server/share",
      });

      expect(result.mount_path).to.equal(path.join(musicDir, "my-nas"));
      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0].mount_path).to.equal(
        path.join(musicDir, "my-nas"),
      );
    });

    it("should avoid collisions when auto-generating a mount segment", () => {
      const existing = localSource({
        id: 1,
        type: "smb",
        name: "My NAS",
        uri: "//server/a",
        mount_path: path.join(musicDir, "my-nas"),
      });
      const created = localSource({
        id: 2,
        type: "smb",
        name: "My NAS",
        uri: "//server/b",
        mount_path: path.join(musicDir, "my-nas-2"),
      });
      createStub.returns(2);
      getByIdStub.returns(created);
      getAllStub.returns([existing]);

      const result = storageService.createStorageSource({
        name: "My NAS",
        type: "smb",
        uri: "//server/b",
      });

      expect(result.mount_path).to.equal(path.join(musicDir, "my-nas-2"));
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

  describe("mountSource (local)", () => {
    it("should create the symlink idempotently without any mount command", async () => {
      const source = localSource({
        uri: targetDir,
        mount_path: path.join(musicDir, "mounted"),
      });
      getByIdStub.returns(source);

      const first = await storageService.mountSource(1);
      const second = await storageService.mountSource(1);

      expect(first.success).to.be.true;
      expect(second.success).to.be.true;
      expect(fs.lstatSync(source.mount_path).isSymbolicLink()).to.be.true;
      const mountCalls = execSyncStub
        .getCalls()
        .filter((c) => c.args[0].includes("mount"));
      expect(mountCalls).to.have.length(0);
      expect(
        storageService.storageHooks.scanLibrary.callCount,
      ).to.be.greaterThan(0);
    });

    it("should return an error when the local folder is missing", async () => {
      const source = localSource({
        uri: path.join(targetDir, "missing"),
        mount_path: path.join(musicDir, "mounted"),
      });
      getByIdStub.returns(source);

      const result = await storageService.mountSource(1);

      expect(result.success).to.be.false;
      expect(result.error).to.include("does not exist");
      expect(execSyncStub.calledWith(sinon.match(/mount/))).to.be.false;
    });
  });

  describe("unmountSource (local)", () => {
    it("should remove the symlink idempotently", async () => {
      fs.symlinkSync(targetDir, path.join(musicDir, "mounted"));
      getByIdStub.returns(
        localSource({
          uri: targetDir,
          mount_path: path.join(musicDir, "mounted"),
        }),
      );

      const result = await storageService.unmountSource(1);

      expect(result.success).to.be.true;
      expect(fs.existsSync(path.join(musicDir, "mounted"))).to.be.false;
      expect(execSyncStub.called).to.be.false;
    });
  });

  describe("mountAllEnabled", () => {
    it("should symlink enabled local sources and mount smb/nfs via sudo", async () => {
      const local = localSource({
        id: 1,
        type: "local",
        name: "Local",
        uri: targetDir,
        mount_path: path.join(musicDir, "L"),
      });
      const smb = localSource({
        id: 2,
        type: "smb",
        name: "Smb",
        uri: "//server/share",
        mount_path: path.join(musicDir, "S"),
      });
      getAllStub.returns([local, smb]);

      await storageService.mountAllEnabled();

      expect(fs.lstatSync(local.mount_path).isSymbolicLink()).to.be.true;
      expect(execSyncStub.calledWith(sinon.match(/cifs/))).to.be.true;
    });
  });
});
