import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";
import { createMockReq, createMockRes } from "../helpers.js";

describe("Player Controller", () => {
  let controller: any;

  beforeEach(async () => {
    controller = await esmock(
      new URL("../../controllers/playerController.ts", import.meta.url)
        .pathname,
      {},
      {
        "../../services/playerService": {
          playTrack: sinon.stub().resolves({ success: true }),
          pauseTrack: sinon.stub().resolves({ success: true }),
          nextTrack: sinon.stub().resolves(undefined),
          previousTrack: sinon.stub().resolves(undefined),
          goToPosition: sinon.stub().resolves(undefined),
          enableRepeat: sinon.stub().resolves(undefined),
          enableRandom: sinon.stub().resolves(undefined),
          enableConsume: sinon.stub().resolves(undefined),
          setSingle: sinon.stub().resolves(undefined),
          setVolume: sinon.stub().resolves(undefined),
          clearQueue: sinon.stub().resolves(undefined),
        },
      },
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("playTrackHandler", () => {
    it("should call playTrack with file and return 200 with message", async () => {
      const req = createMockReq({ body: { file: "song.mp3" } });
      const res = createMockRes();

      await controller.playTrackHandler(req, res);

      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Playing track: song.mp3",
      });
    });
  });

  describe("pauseTrackHandler", () => {
    it("should return 200 with pause message", async () => {
      const req = createMockReq();
      const res = createMockRes();

      await controller.pauseTrackHandler(req, res);

      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Playback paused",
      });
    });
  });

  describe("goToPositionHandler", () => {
    it("should call goToPosition with position from body", async () => {
      const req = createMockReq({ body: { position: 42 } });
      const res = createMockRes();

      await controller.goToPositionHandler(req, res);

      expect(res.json.calledOnce).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Moved to position 42",
      });
    });
  });

  describe("nextTrackHandler", () => {
    it("should return 200 with next track message", async () => {
      const req = createMockReq();
      const res = createMockRes();

      await controller.nextTrackHandler(req, res);

      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Skipped to next track",
      });
    });
  });

  describe("previousTrackHandler", () => {
    it("should return 200 with previous track message", async () => {
      const req = createMockReq();
      const res = createMockRes();

      await controller.previousTrackHandler(req, res);

      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Went back to previous track",
      });
    });
  });

  describe("setVolumeHandler", () => {
    it("should call setVolume with volume from body", async () => {
      const req = createMockReq({ body: { volume: 75 } });
      const res = createMockRes();

      await controller.setVolumeHandler(req, res);

      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Volume set to 75",
      });
    });
  });

  describe("enableRepeatHandler", () => {
    it("should return enabled message when repeat is turned on", async () => {
      const req = createMockReq({ body: { enabled: true } });
      const res = createMockRes();

      await controller.enableRepeatHandler(req, res);

      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Repeat enabled",
      });
    });

    it("should return disabled message when repeat is turned off", async () => {
      const req = createMockReq({ body: { enabled: false } });
      const res = createMockRes();

      await controller.enableRepeatHandler(req, res);

      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Repeat disabled",
      });
    });
  });

  describe("enableRandomHandler", () => {
    it("should return random enabled/disabled message", async () => {
      const req = createMockReq({ body: { enabled: true } });
      const res = createMockRes();

      await controller.enableRandomHandler(req, res);

      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Random enabled",
      });
    });
  });

  describe("enableConsumeHandler", () => {
    it("should return consume enabled/disabled message", async () => {
      const req = createMockReq({ body: { enabled: true } });
      const res = createMockRes();

      await controller.enableConsumeHandler(req, res);

      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Consume enabled",
      });
    });
  });

  describe("setSingleHandler", () => {
    it("should return single enabled/disabled message", async () => {
      const req = createMockReq({ body: { enabled: true } });
      const res = createMockRes();

      await controller.setSingleHandler(req, res);

      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Single enabled",
      });
    });
  });

  describe("clearQueueHandler", () => {
    it("should return queue cleared message", async () => {
      const req = createMockReq();
      const res = createMockRes();

      await controller.clearQueueHandler(req, res);

      expect(res.json.firstCall.args[0]).to.deep.equal({
        message: "Queue cleared",
      });
    });
  });
});
