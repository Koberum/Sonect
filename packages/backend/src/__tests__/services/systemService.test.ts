import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";

const APLAY_OUTPUT = `**** List of PLAYBACK Hardware Devices ****
card 0: PCH [HDA Intel PCH], device 0: ALC671 Analog [ALC671 Analog]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
card 1: HDMI [HDA Intel HDMI], device 3: HDMI 0 [HDMI 0]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
card 1: HDMI [HDA Intel HDMI], device 7: HDMI 1 [HDMI 1]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
card 1: HDMI [HDA Intel HDMI], device 8: HDMI 2 [HDMI 2]
  Subdevices: 1/1
  Subdevice #0: subdevice #0
`;

describe("System Service", () => {
  describe("detectAudioDevices", () => {
    let systemService: any;
    let execSyncStub: sinon.SinonStub;

    beforeEach(async () => {
      execSyncStub = sinon.stub().returns("");
      systemService = await esmock(
        new URL("../../services/systemService.ts", import.meta.url).pathname,
        {
          child_process: {
            execSync: execSyncStub,
          },
        },
      );
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return unique device entries per playback device", () => {
      execSyncStub.withArgs("aplay -l 2>/dev/null").returns(APLAY_OUTPUT);

      const devices = systemService.detectAudioDevices();

      expect(devices).to.have.length(4);
      const cards = devices.map((d: { card: string }) => d.card);
      expect(cards).to.deep.equal(["hw:0,0", "hw:1,3", "hw:1,7", "hw:1,8"]);
      expect(new Set(cards).size).to.equal(4);
    });

    it("should use the device friendly name as description", () => {
      execSyncStub.withArgs("aplay -l 2>/dev/null").returns(APLAY_OUTPUT);

      const devices = systemService.detectAudioDevices();

      expect(devices[0].description).to.equal("ALC671 Analog");
      expect(devices[1].description).to.equal("HDMI 0");
      expect(devices[2].description).to.equal("HDMI 1");
      expect(devices[3].description).to.equal("HDMI 2");
      expect(devices[0].name).to.equal("PCH (card 0)");
      expect(devices[1].name).to.equal("HDMI (card 1)");
    });

    it("should return empty array when aplay is not available", () => {
      execSyncStub
        .withArgs("aplay -l 2>/dev/null")
        .throws(new Error("not found"));

      const devices = systemService.detectAudioDevices();

      expect(devices).to.deep.equal([]);
    });
  });
});
