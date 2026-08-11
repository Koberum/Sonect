import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";

describe("Config Service", () => {
  let configService: any;
  let execSyncStub: sinon.SinonStub;
  let fsExistsSyncStub: sinon.SinonStub;
  let fsMkdirSyncStub: sinon.SinonStub;
  let fsReadStub: sinon.SinonStub;
  let fsWriteStub: sinon.SinonStub;

  beforeEach(async () => {
    process.env.MPD_CONFIG_PATH = "/opt/sonect/data/mpd-audio.conf";

    execSyncStub = sinon.stub();
    fsExistsSyncStub = sinon.stub();
    fsMkdirSyncStub = sinon.stub();
    fsReadStub = sinon.stub();
    fsWriteStub = sinon.stub();

    configService = await esmock(
      new URL("../../services/configService.ts", import.meta.url).pathname,
      {
        child_process: {
          execSync: execSyncStub,
        },
        fs: {
          existsSync: fsExistsSyncStub,
          mkdirSync: fsMkdirSyncStub,
          readFileSync: fsReadStub,
          writeFileSync: fsWriteStub,
        },
      },
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getConfig", () => {
    it("should read MPD config file and return path", () => {
      fsExistsSyncStub.returns(true);
      fsReadStub.returns("music_directory /music\n");

      const result = configService.getConfig();

      expect(result.content).to.equal("music_directory /music\n");
      expect(result.path).to.equal("/opt/sonect/data/mpd-audio.conf");
    });
  });

  describe("getConfigPath", () => {
    it("should return the MPD config path", () => {
      expect(configService.getConfigPath()).to.equal(
        "/opt/sonect/data/mpd-audio.conf",
      );
    });
  });

  describe("updateConfig", () => {
    const newContent = "music_directory /new/path\n";

    it("should write config and restart MPD via systemctl", () => {
      execSyncStub.withArgs("which systemctl").returns("/usr/bin/systemctl");

      const result = configService.updateConfig(newContent);

      expect(result.success).to.be.true;
      expect(
        fsWriteStub.calledWith(
          "/opt/sonect/data/mpd-audio.conf",
          newContent,
          "utf-8",
        ),
      ).to.be.true;
      expect(execSyncStub.calledWith("sudo systemctl restart mpd")).to.be.true;
    });

    it("should fall back to service command", () => {
      execSyncStub.withArgs("which systemctl").throws(new Error("not found"));
      execSyncStub.withArgs("which service").returns("/usr/sbin/service");

      const result = configService.updateConfig(newContent);

      expect(result.success).to.be.true;
      expect(execSyncStub.calledWith("service mpd restart")).to.be.true;
    });

    it("should warn when restart fails", () => {
      execSyncStub.withArgs("which systemctl").returns("/usr/bin/systemctl");
      execSyncStub
        .withArgs("sudo systemctl restart mpd")
        .throws(new Error("failed"));

      const result = configService.updateConfig(newContent);

      expect(result.success).to.be.true;
      expect(result.warning).to.include("Restart MPD manually");
    });

    it("should return failure when writeFileSync throws", () => {
      fsWriteStub.throws(new Error("EACCES"));

      const result = configService.updateConfig(newContent);

      expect(result.success).to.be.false;
      expect(result.warning).to.include("Check file permissions");
    });

    it("should warn when no init system is available", () => {
      execSyncStub.throws(new Error("not found"));

      const result = configService.updateConfig(newContent);

      expect(result.success).to.be.true;
      expect(result.warning).to.include("Restart MPD manually");
    });
  });

  describe("ensureFollowOutsideSymlinks", () => {
    it("should append the option and restart MPD when missing", () => {
      fsExistsSyncStub.returns(true);
      fsReadStub.returns('audio_output {\n  type "alsa"\n}\n');
      execSyncStub.withArgs("which systemctl").returns("/usr/bin/systemctl");

      const result = configService.ensureFollowOutsideSymlinks();

      expect(result.success).to.be.true;
      const written = fsWriteStub.getCall(0).args[1] as string;
      expect(written).to.include('follow_outside_symlinks "yes"');
      expect(execSyncStub.calledWith("sudo systemctl restart mpd")).to.be.true;
    });

    it("should not write or restart when the option is already present", () => {
      fsExistsSyncStub.returns(true);
      fsReadStub.returns('follow_outside_symlinks "yes"\n');

      const result = configService.ensureFollowOutsideSymlinks();

      expect(result.success).to.be.true;
      expect(fsWriteStub.called).to.be.false;
      expect(execSyncStub.calledWith("sudo systemctl restart mpd")).to.be.false;
    });

    it("should return failure when the drop-in is not writable", () => {
      fsExistsSyncStub.returns(true);
      fsReadStub.returns("");
      fsWriteStub.throws(new Error("EACCES"));

      const result = configService.ensureFollowOutsideSymlinks();

      expect(result.success).to.be.false;
      expect(result.warning).to.include("Check file permissions");
    });
  });
});
