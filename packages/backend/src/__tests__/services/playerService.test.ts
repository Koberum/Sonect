import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";
import { mpdConnectionManager } from "../../services/mpdConnectionManager";

describe("Player Service", () => {
  let playerService: any;

  const defaultStatus = {
    state: "stop",
    elapsed: 0,
    duration: 0,
    volume: 50,
    repeat: false,
    random: false,
    single: false,
    consume: false,
  };

  beforeEach(async () => {
    sinon.stub(mpdConnectionManager, "executeCommand").resolves("");
    sinon.stub(mpdConnectionManager, "executeCommandList").resolves("");
    sinon.stub(mpdConnectionManager, "getCachedStatus").returns(defaultStatus);
    sinon.stub(mpdConnectionManager, "refreshNow").resolves();
    sinon.stub(mpdConnectionManager, "getCmdClient").returns({
      on: sinon.stub(),
      off: sinon.stub(),
    } as any);

    playerService = await esmock("../../services/playerService.ts", {
      "@repo/db": {
        tracksDb: {
          getByFile: sinon.stub().returns(undefined),
          getByAlbumOrdered: sinon.stub().returns([]),
          getByArtist: sinon.stub().returns([]),
        },
        albumsDb: {},
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("playTrack", () => {
    it("should clear queue, add file, and play", async () => {
      const result = await playerService.playTrack("song.mp3");
      expect(result).to.deep.equal({ success: true });

      sinon.assert.calledWith(
        mpdConnectionManager.executeCommandList as sinon.SinonStub,
        [
          { command: "clear" },
          { command: "add", args: ["song.mp3"] },
          { command: "consume", args: ["1"] },
          { command: "play" },
        ],
      );
    });

    it("should throw PlayTrackError when file is not provided", async () => {
      try {
        await playerService.playTrack(undefined);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.name).to.equal("PlayTrackError");
        expect(err.message).to.equal("File non specificato");
      }
    });

    it("should throw PlayTrackError on MPD failure", async () => {
      (mpdConnectionManager.executeCommandList as sinon.SinonStub).rejects(
        new Error("MPD connection lost"),
      );
      try {
        await playerService.playTrack("song.mp3");
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.name).to.equal("PlayTrackError");
      }
    });
  });

  describe("pauseTrack", () => {
    it("should pause playback", async () => {
      const result = await playerService.pauseTrack();
      expect(result).to.deep.equal({ success: true });
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "pause",
      );
    });
  });

  describe("nextTrack", () => {
    it("should skip to next track", async () => {
      await playerService.nextTrack();
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "next",
      );
    });
  });

  describe("previousTrack", () => {
    it("should go back to previous track", async () => {
      await playerService.previousTrack();
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "previous",
      );
    });
  });

  describe("goToPosition", () => {
    it("should seek to given position", async () => {
      await playerService.goToPosition(42);
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "seekcur",
        ["42"],
      );
    });
  });

  describe("enableRepeat", () => {
    it("should enable repeat", async () => {
      await playerService.enableRepeat(true);
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "repeat",
        ["1"],
      );
    });

    it("should disable repeat", async () => {
      await playerService.enableRepeat(false);
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "repeat",
        ["0"],
      );
    });
  });

  describe("enableRandom", () => {
    it("should enable random", async () => {
      await playerService.enableRandom(true);
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "random",
        ["1"],
      );
    });
  });

  describe("enableConsume", () => {
    it("should enable consume", async () => {
      await playerService.enableConsume(true);
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "consume",
        ["1"],
      );
    });
  });

  describe("setSingle", () => {
    it("should enable single mode", async () => {
      await playerService.setSingle(true);
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "single",
        ["1"],
      );
    });
  });

  describe("setVolume", () => {
    it("should set volume within range", async () => {
      await playerService.setVolume(75);
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "setvol",
        ["75"],
      );
    });

    it("should throw for volume below 0", async () => {
      try {
        await playerService.setVolume(-5);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).to.equal("Volume needs to be between 0 and 100");
      }
    });

    it("should throw for volume above 100", async () => {
      try {
        await playerService.setVolume(150);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).to.equal("Volume needs to be between 0 and 100");
      }
    });
  });

  describe("clearQueue", () => {
    it("should clear the MPD queue", async () => {
      await playerService.clearQueue();
      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "clear",
      );
    });
  });

  describe("updateLibrary", () => {
    it("should trigger MPD library update", async () => {
      (mpdConnectionManager.executeCommand as sinon.SinonStub).callsFake(
        async (cmd: string) => {
          if (cmd === "status") return "updating_db: \n";
          return "";
        },
      );

      await playerService.updateLibrary();

      sinon.assert.calledWith(
        mpdConnectionManager.executeCommand as sinon.SinonStub,
        "update",
      );
    });
  });

  describe("getPlaybackStatus", () => {
    it("should return cached playback status synchronously", () => {
      const status = playerService.getPlaybackStatus();
      expect(status).to.include.keys(
        "state",
        "elapsed",
        "duration",
        "volume",
        "repeat",
        "random",
        "single",
        "consume",
      );
      expect(status.state).to.equal("stop");
      expect(status.volume).to.equal(50);
    });
  });
});
