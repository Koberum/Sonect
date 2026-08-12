import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";
import { createMockReq, createMockRes } from "../helpers.js";

describe("System Controller", () => {
  let controller: any;

  const mockSystemService = {
    getSystemStatus: sinon.stub(),
  };

  const mockAudioService = {
    getAudioDevices: sinon.stub(),
    configureAudioOutput: sinon.stub(),
    getCurrentAudioOutput: sinon.stub(),
    restartMPD: sinon.stub(),
    stopMPD: sinon.stub(),
    getMpdStatus: sinon.stub(),
  };

  const mockNetworkService = {
    scanWifi: sinon.stub(),
    connectWifi: sinon.stub(),
    disconnectWifi: sinon.stub(),
    getNetworkStatus: sinon.stub(),
    isNmcliAvailable: sinon.stub(),
  };

  const mockSetupService = {
    getSetupProgress: sinon.stub(),
    isSetupComplete: sinon.stub(),
    markStepComplete: sinon.stub(),
    markStepIncomplete: sinon.stub(),
    markSetupCompleted: sinon.stub(),
    resetSetup: sinon.stub(),
    getNextIncompleteStep: sinon.stub(),
  };

  const mockStorageSource = {
    id: 1,
    name: "My NAS",
    type: "smb",
    uri: "smb://server/share",
    mount_path: "NAS",
    enabled: 1,
  };

  const mockStorageService = {
    getStorageSources: sinon.stub(),
    getStorageSource: sinon.stub(),
    createStorageSource: sinon.stub(),
    updateStorageSource: sinon.stub(),
    deleteStorageSource: sinon.stub(),
    mountSource: sinon.stub(),
    unmountSource: sinon.stub(),
    listMounts: sinon.stub(),
  };

  beforeEach(async () => {
    sinon.resetHistory();

    mockSystemService.getSystemStatus.returns({
      tools: { aplay: true, systemctl: true },
      audio: { available: true, cards: [] },
      network: { available: true, connected: false },
      mpdConnected: true,
      setupCompleted: [],
    });
    mockAudioService.getAudioDevices.returns([]);
    mockAudioService.configureAudioOutput.returns({ success: true });
    mockAudioService.getCurrentAudioOutput.returns({
      card: "hw:0,0",
      name: "Built-in",
    });
    mockAudioService.restartMPD.returns({ success: true });
    mockAudioService.stopMPD.returns({ success: true });
    mockAudioService.getMpdStatus.returns({ running: true });
    mockNetworkService.scanWifi.returns([]);
    mockNetworkService.connectWifi.resolves({ success: true });
    mockNetworkService.disconnectWifi.resolves({ success: true });
    mockNetworkService.getNetworkStatus.returns({
      connected: false,
    });
    mockNetworkService.isNmcliAvailable.returns(true);
    mockSetupService.getSetupProgress.returns([]);
    mockSetupService.isSetupComplete.returns(false);
    mockSetupService.getNextIncompleteStep.returns(null);
    mockStorageService.getStorageSources.returns([mockStorageSource]);
    mockStorageService.getStorageSource.returns(mockStorageSource);
    mockStorageService.createStorageSource.returns(mockStorageSource);
    mockStorageService.updateStorageSource.returns(mockStorageSource);
    mockStorageService.deleteStorageSource.returns(true);
    mockStorageService.mountSource.resolves({ success: true });
    mockStorageService.unmountSource.resolves({ success: true });
    mockStorageService.listMounts.resolves([]);

    controller = await esmock(
      new URL("../../controllers/systemController.ts", import.meta.url)
        .pathname,
      {},
      {
        "../../services/systemService": mockSystemService,
        "../../services/audioService": mockAudioService,
        "../../services/networkService": mockNetworkService,
        "../../services/setupService": mockSetupService,
        "../../services/storageService": mockStorageService,
      },
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getStatusHandler", () => {
    it("should return system status with setup progress", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getStatusHandler(req, res, next);

      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg.tools).to.exist;
      expect(jsonArg.audio).to.exist;
      expect(jsonArg.setupCompleted).to.deep.equal([]);
    });
  });

  describe("getAudioDevicesHandler", () => {
    it("should return audio devices list", async () => {
      const devices = [
        {
          card: "hw:1,0",
          name: "USB DAC (card 1)",
          description: "USB DAC",
          usb: true,
        },
      ];
      mockAudioService.getAudioDevices.returns(devices);
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getAudioDevicesHandler(req, res, next);

      expect(res.json.calledWith(devices)).to.be.true;
    });
  });

  describe("configureAudioHandler", () => {
    it("should apply audio configuration", async () => {
      const req = createMockReq({
        body: { card: "hw:1,0", name: "USB DAC", mixerType: "hardware" },
      });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.configureAudioHandler(req, res, next);

      expect(
        mockAudioService.configureAudioOutput.calledWith({
          card: "hw:1,0",
          name: "USB DAC",
          mixerType: "hardware",
        }),
      ).to.be.true;
      expect(res.json.calledWith({ success: true })).to.be.true;
    });

    it("should return 400 for invalid body", async () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.configureAudioHandler(req, res, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("getAudioStatusHandler", () => {
    it("should return current audio output", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getAudioStatusHandler(req, res, next);

      expect(res.json.calledWith({ card: "hw:0,0", name: "Built-in" })).to.be
        .true;
    });
  });

  describe("scanWifiHandler", () => {
    it("should return scanned networks", async () => {
      const networks = [{ ssid: "MyNet", signal: 85, secured: true }];
      mockNetworkService.scanWifi.returns(networks);
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.scanWifiHandler(req, res, next);

      expect(res.json.calledWith(networks)).to.be.true;
    });

    it("should return 400 when nmcli is not available", async () => {
      mockNetworkService.isNmcliAvailable.returns(false);
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.scanWifiHandler(req, res, next);

      expect(res.status.calledWith(400)).to.be.true;
    });
  });

  describe("connectWifiHandler", () => {
    it("should connect to WiFi", async () => {
      const req = createMockReq({
        body: { ssid: "MyNet", password: "pass123" },
      });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.connectWifiHandler(req, res, next);

      expect(mockNetworkService.connectWifi.calledWith("MyNet", "pass123")).to
        .be.true;
      expect(res.json.calledWith({ success: true })).to.be.true;
    });

    it("should return 400 for missing SSID", async () => {
      const req = createMockReq({ body: {} });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.connectWifiHandler(req, res, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("disconnectWifiHandler", () => {
    it("should disconnect WiFi", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.disconnectWifiHandler(req, res, next);

      expect(mockNetworkService.disconnectWifi.calledOnce).to.be.true;
      expect(res.json.calledWith({ success: true })).to.be.true;
    });
  });

  describe("getNetworkStatusHandler", () => {
    it("should return network status", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getNetworkStatusHandler(req, res, next);

      expect(res.json.calledWith({ connected: false })).to.be.true;
    });
  });

  describe("getStorageSourcesHandler", () => {
    it("should return all storage sources", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getStorageSourcesHandler(req, res, next);

      expect(res.json.calledWith([mockStorageSource])).to.be.true;
    });
  });

  describe("getStorageSourceHandler", () => {
    it("should return a storage source by id", async () => {
      const req = createMockReq({ params: { id: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getStorageSourceHandler(req, res, next);

      expect(mockStorageService.getStorageSource.calledWith(1)).to.be.true;
      expect(res.json.calledWith(mockStorageSource)).to.be.true;
    });

    it("should return 404 when source not found", async () => {
      mockStorageService.getStorageSource.returns(null);
      const req = createMockReq({ params: { id: "999" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getStorageSourceHandler(req, res, next);

      expect(next.calledOnce).to.be.true;
      expect(next.firstCall.args[0].message).to.equal(
        "Storage source 999 not found",
      );
    });
  });

  describe("createStorageSourceHandler", () => {
    it("should create a new storage source", async () => {
      const req = createMockReq({
        body: {
          name: "New NAS",
          type: "smb",
          uri: "smb://new/share",
          mount_path: "NAS2",
        },
      });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.createStorageSourceHandler(req, res, next);

      expect(res.status.calledWith(201)).to.be.true;
      expect(res.json.calledWith(mockStorageSource)).to.be.true;
    });
  });

  describe("updateStorageSourceHandler", () => {
    it("should update a storage source", async () => {
      const req = createMockReq({
        params: { id: "1" },
        body: { name: "Renamed NAS" },
      });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.updateStorageSourceHandler(req, res, next);

      expect(
        mockStorageService.updateStorageSource.calledWith(1, {
          name: "Renamed NAS",
        }),
      ).to.be.true;
    });

    it("should return 404 when source not found", async () => {
      mockStorageService.updateStorageSource.returns(null);
      const req = createMockReq({
        params: { id: "999" },
        body: { name: "X" },
      });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.updateStorageSourceHandler(req, res, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("deleteStorageSourceHandler", () => {
    it("should delete a storage source", async () => {
      const req = createMockReq({ params: { id: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.deleteStorageSourceHandler(req, res, next);

      expect(res.json.calledWith({ success: true })).to.be.true;
    });

    it("should return 404 when source not found", async () => {
      mockStorageService.deleteStorageSource.returns(false);
      const req = createMockReq({ params: { id: "999" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.deleteStorageSourceHandler(req, res, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("mountStorageHandler", () => {
    it("should mount a storage source", async () => {
      const req = createMockReq({ params: { id: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.mountStorageHandler(req, res, next);

      expect(mockStorageService.mountSource.calledWith(1)).to.be.true;
      expect(res.json.calledWith({ success: true })).to.be.true;
    });
  });

  describe("unmountStorageHandler", () => {
    it("should unmount a storage source", async () => {
      const req = createMockReq({ params: { id: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.unmountStorageHandler(req, res, next);

      expect(mockStorageService.unmountSource.calledWith(1)).to.be.true;
      expect(res.json.calledWith({ success: true })).to.be.true;
    });
  });

  describe("listMountsHandler", () => {
    it("should list mounts", async () => {
      const mounts = [{ path: "/mnt/nas", uri: "smb://server/share" }];
      mockStorageService.listMounts.resolves(mounts);
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.listMountsHandler(req, res, next);

      expect(res.json.calledWith(mounts)).to.be.true;
    });
  });

  describe("getSetupProgressHandler", () => {
    it("should return setup progress", async () => {
      const steps = [
        { step: "storage", completed: true },
        { step: "audio", completed: false },
        { step: "sync", completed: false },
      ];
      mockSetupService.getSetupProgress.returns(steps);
      mockSetupService.isSetupComplete.returns(true);
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getSetupProgressHandler(req, res, next);

      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg.steps).to.deep.equal(steps);
      expect(jsonArg.complete).to.be.true;
      expect(jsonArg.nextStep).to.be.null;
    });

    it("should report incomplete when no storage is configured", async () => {
      mockSetupService.getSetupProgress.returns([]);
      mockSetupService.isSetupComplete.returns(false);
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getSetupProgressHandler(req, res, next);

      const jsonArg = res.json.firstCall.args[0];
      expect(jsonArg.complete).to.be.false;
    });
  });

  describe("updateSetupProgressHandler", () => {
    it("should mark step as complete and flag setup done", async () => {
      const req = createMockReq({
        body: { step: "audio", completed: true },
      });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.updateSetupProgressHandler(req, res, next);

      expect(mockSetupService.markStepComplete.calledWith("audio")).to.be.true;
      expect(mockSetupService.markSetupCompleted.calledOnce).to.be.true;
    });

    it("should mark step as incomplete", async () => {
      const req = createMockReq({
        body: { step: "sync", completed: false },
      });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.updateSetupProgressHandler(req, res, next);

      expect(mockSetupService.markStepIncomplete.calledWith("sync")).to.be.true;
    });
  });

  describe("resetSetupHandler", () => {
    it("should reset setup progress", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.resetSetupHandler(req, res, next);

      expect(mockSetupService.resetSetup.calledOnce).to.be.true;
      expect(res.json.calledWith({ success: true })).to.be.true;
    });
  });

  describe("restartMpdHandler", () => {
    it("should restart MPD", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.restartMpdHandler(req, res, next);

      expect(mockAudioService.restartMPD.calledOnce).to.be.true;
      expect(res.json.calledWith({ success: true })).to.be.true;
    });
  });

  describe("stopMpdHandler", () => {
    it("should stop MPD", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.stopMpdHandler(req, res, next);

      expect(mockAudioService.stopMPD.calledOnce).to.be.true;
      expect(res.json.calledWith({ success: true })).to.be.true;
    });
  });

  describe("getMpdStatusHandler", () => {
    it("should return MPD status", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getMpdStatusHandler(req, res, next);

      expect(res.json.calledWith({ running: true })).to.be.true;
    });
  });
});
