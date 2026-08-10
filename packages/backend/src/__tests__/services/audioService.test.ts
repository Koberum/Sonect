import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";

const MPD_CONF_EXAMPLE = `
music_directory "/music"
audio_output {
    type        "alsa"
    name        "My DAC"
    device      "hw:1,0"
    mixer_type  "hardware"
}
`;

describe("Audio Service", () => {
  let audioService: any;
  let execSyncStub: sinon.SinonStub;
  let fsReadStub: sinon.SinonStub;
  let fsWriteStub: sinon.SinonStub;
  let fsExistsStub: sinon.SinonStub;
  let detectAudioDevicesStub: sinon.SinonStub;

  beforeEach(async () => {
    execSyncStub = sinon.stub();
    fsReadStub = sinon.stub();
    fsWriteStub = sinon.stub();
    fsExistsStub = sinon.stub().returns(true);
    detectAudioDevicesStub = sinon.stub().returns([]);

    audioService = await esmock(
      new URL("../../services/audioService.ts", import.meta.url).pathname,
      {
        child_process: {
          execSync: execSyncStub,
        },
        fs: {
          readFileSync: fsReadStub,
          writeFileSync: fsWriteStub,
          existsSync: fsExistsStub,
        },
      },
      {
        "../../services/systemService": {
          detectAudioDevices: detectAudioDevicesStub,
        },
      },
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getAudioDevices", () => {
    it("should delegate to detectAudioDevices", () => {
      const devices = [
        {
          card: "hw:0,0",
          name: "Built-in (card 0)",
          description: "Built-in",
          usb: false,
        },
      ];
      detectAudioDevicesStub.returns(devices);

      const cards = audioService.getAudioDevices();

      expect(cards).to.deep.equal(devices);
      expect(detectAudioDevicesStub.calledOnce).to.be.true;
    });

    it("should return empty array when no devices found", () => {
      const cards = audioService.getAudioDevices();

      expect(cards).to.deep.equal([]);
    });
  });

  describe("getCurrentAudioOutput", () => {
    it("should return card and name from MPD config", () => {
      fsReadStub.returns(MPD_CONF_EXAMPLE);

      const result = audioService.getCurrentAudioOutput();

      expect(result).to.deep.equal({ card: "hw:1,0", name: "My DAC" });
    });

    it("should return null when no audio_output block exists", () => {
      fsReadStub.returns("music_directory /music\n");

      const result = audioService.getCurrentAudioOutput();

      expect(result).to.be.null;
    });

    it("should return null when config file is unreadable", () => {
      fsReadStub.throws(new Error("ENOENT"));

      const result = audioService.getCurrentAudioOutput();

      expect(result).to.be.null;
    });
  });

  describe("configureAudioOutput", () => {
    const params = {
      card: "hw:2,0",
      name: "New DAC",
      mixerType: "software" as const,
    };

    it("should write config and restart MPD", () => {
      fsReadStub.returns(MPD_CONF_EXAMPLE);
      execSyncStub.returns("");

      const result = audioService.configureAudioOutput(params);

      expect(result.success).to.be.true;
      expect(fsWriteStub.calledOnce).to.be.true;
      const newConfig = fsWriteStub.firstCall.args[1] as string;
      expect(newConfig).to.include('device      "hw:2,0"');
      expect(newConfig).to.include('mixer_type  "software"');
    });

    it("should add audio_output block when none exists", () => {
      fsReadStub.returns("music_directory /music\n");
      execSyncStub.returns("");

      const result = audioService.configureAudioOutput(params);

      expect(result.success).to.be.true;
      const newConfig = fsWriteStub.firstCall.args[1] as string;
      expect(newConfig).to.include("audio_output {");
    });

    it("should return failure when config file is unreadable", () => {
      fsReadStub.throws(new Error("ENOENT"));

      const result = audioService.configureAudioOutput(params);

      expect(result.success).to.be.false;
      expect(result.warning).to.include("Cannot read");
    });

    it("should return failure when config file is unwritable", () => {
      fsReadStub.returns(MPD_CONF_EXAMPLE);
      fsWriteStub.throws(new Error("EPERM"));

      const result = audioService.configureAudioOutput(params);

      expect(result.success).to.be.false;
      expect(result.warning).to.include("Cannot write");
    });
  });

  describe("restartMPD", () => {
    it("should use systemctl to restart MPD", () => {
      execSyncStub.withArgs("which systemctl").returns("/usr/bin/systemctl");

      const result = audioService.restartMPD();

      expect(result.success).to.be.true;
      expect(execSyncStub.calledWith("sudo systemctl restart mpd")).to.be.true;
    });

    it("should fall back to service command", () => {
      execSyncStub.withArgs("which systemctl").throws(new Error("not found"));
      execSyncStub.withArgs("which service").returns("/usr/sbin/service");

      const result = audioService.restartMPD();

      expect(result.success).to.be.true;
      expect(execSyncStub.calledWith("service mpd restart")).to.be.true;
    });

    it("should warn when restart fails", () => {
      execSyncStub.withArgs("which systemctl").returns("/usr/bin/systemctl");
      execSyncStub
        .withArgs("sudo systemctl restart mpd")
        .throws(new Error("failed"));

      const result = audioService.restartMPD();

      expect(result.success).to.be.true;
      expect(result.warning).to.include("Restart MPD manually");
    });

    it("should warn when neither systemctl nor service is available", () => {
      execSyncStub.throws(new Error("not found"));

      const result = audioService.restartMPD();

      expect(result.success).to.be.true;
      expect(result.warning).to.include("Restart MPD manually");
    });
  });

  describe("stopMPD", () => {
    it("should use systemctl to stop MPD", () => {
      execSyncStub.withArgs("which systemctl").returns("/usr/bin/systemctl");

      const result = audioService.stopMPD();

      expect(result.success).to.be.true;
      expect(execSyncStub.calledWith("sudo systemctl stop mpd")).to.be.true;
    });

    it("should return false when no init system is available", () => {
      execSyncStub.throws(new Error("not found"));

      const result = audioService.stopMPD();

      expect(result.success).to.be.false;
      expect(result.warning).to.include("Neither systemctl nor service");
    });
  });

  describe("getMpdStatus", () => {
    it("should return running: true when systemctl shows active", () => {
      execSyncStub.withArgs("which systemctl").returns("/usr/bin/systemctl");
      execSyncStub.withArgs("systemctl is-active --quiet mpd").returns("");

      const result = audioService.getMpdStatus();

      expect(result.running).to.be.true;
    });

    it("should return running: false when systemctl shows inactive", () => {
      execSyncStub.withArgs("which systemctl").returns("/usr/bin/systemctl");
      execSyncStub
        .withArgs("systemctl is-active --quiet mpd")
        .throws(new Error("inactive"));

      const result = audioService.getMpdStatus();

      expect(result.running).to.be.false;
    });

    it("should fall back to pgrep when systemctl is unavailable", () => {
      execSyncStub.withArgs("which systemctl").throws(new Error("not found"));
      execSyncStub.withArgs("pgrep -x mpd").returns("1234\n");

      const result = audioService.getMpdStatus();

      expect(result.running).to.be.true;
      expect(result.pid).to.equal("1234");
    });

    it("should return running: false when pgrep finds no process", () => {
      execSyncStub.withArgs("which systemctl").throws(new Error("not found"));
      execSyncStub.withArgs("pgrep -x mpd").throws(new Error("no process"));

      const result = audioService.getMpdStatus();

      expect(result.running).to.be.false;
    });
  });
});
