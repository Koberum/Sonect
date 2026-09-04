import { expect } from "chai";
import sinon from "sinon";
import express from "express";
import supertest from "supertest";
import * as dbModule from "@repo/db";
import { mpdConnectionManager } from "../../services/mpdConnectionManager";
import { errorHandler } from "../../middleware/errorHandler";

describe("Player Routes", () => {
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(async () => {
    sinon.resetHistory();

    sinon.stub(mpdConnectionManager, "executeCommand").resolves("");
    sinon.stub(mpdConnectionManager, "executeCommandList").resolves("");
    sinon.stub(dbModule.tracksDb, "getByFile").returns(undefined);
    sinon.stub(dbModule.tracksDb, "getByAlbumOrdered").returns([]);

    const { default: playerRoutes } =
      await import("../../routes/playerRoutes.ts");

    const app = express();
    app.use(express.json());
    app.use("/mpd", playerRoutes);
    app.use(errorHandler);
    request = supertest(app) as any;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("POST /mpd/play", () => {
    it("should respond with 200 and playing message", async () => {
      const res = await request
        .post("/mpd/play")
        .send({ file: "song.mp3" })
        .expect(200);
      expect(res.body).to.deep.equal({ message: "Playing track: song.mp3" });
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
  });

  describe("POST /mpd/pause", () => {
    it("should respond with 200 and pause message", async () => {
      const res = await request.post("/mpd/pause").expect(200);
      expect(res.body).to.deep.equal({ message: "Playback paused" });
    });
  });

  describe("POST /mpd/position", () => {
    it("should respond with 200 and position message", async () => {
      const res = await request
        .post("/mpd/position")
        .send({ position: 42 })
        .expect(200);
      expect(res.body).to.deep.equal({ message: "Moved to position 42" });
    });
  });

  describe("POST /mpd/next", () => {
    it("should respond with 200", async () => {
      const res = await request.post("/mpd/next").expect(200);
      expect(res.body).to.deep.equal({ message: "Skipped to next track" });
    });
  });

  describe("POST /mpd/previous", () => {
    it("should respond with 200", async () => {
      const res = await request.post("/mpd/previous").expect(200);
      expect(res.body).to.deep.equal({
        message: "Went back to previous track",
      });
    });
  });

  describe("POST /mpd/repeat", () => {
    it("should enable repeat", async () => {
      const res = await request
        .post("/mpd/repeat")
        .send({ enabled: true })
        .expect(200);
      expect(res.body).to.deep.equal({ message: "Repeat enabled" });
    });

    it("should disable repeat", async () => {
      const res = await request
        .post("/mpd/repeat")
        .send({ enabled: false })
        .expect(200);
      expect(res.body).to.deep.equal({ message: "Repeat disabled" });
    });
  });

  describe("POST /mpd/random", () => {
    it("should enable random", async () => {
      const res = await request
        .post("/mpd/random")
        .send({ enabled: true })
        .expect(200);
      expect(res.body).to.deep.equal({ message: "Random enabled" });
    });
  });

  describe("POST /mpd/consume", () => {
    it("should enable consume", async () => {
      const res = await request
        .post("/mpd/consume")
        .send({ enabled: true })
        .expect(200);
      expect(res.body).to.deep.equal({ message: "Consume enabled" });
    });
  });

  describe("POST /mpd/single", () => {
    it("should enable single", async () => {
      const res = await request
        .post("/mpd/single")
        .send({ enabled: true })
        .expect(200);
      expect(res.body).to.deep.equal({ message: "Single enabled" });
    });
  });

  describe("PATCH /mpd/volume", () => {
    it("should set volume", async () => {
      const res = await request
        .patch("/mpd/volume")
        .send({ volume: 75 })
        .expect(200);
      expect(res.body).to.deep.equal({ message: "Volume set to 75" });
    });
  });

  it("should return 404 for unknown routes under /mpd", async () => {
    await request.get("/mpd/unknown").expect(404);
  });

  it("should return 404 for unknown methods on known routes", async () => {
    await request.get("/mpd/play").expect(404);
  });

  it("should not expose an autoplay configuration endpoint", async () => {
    await request.get("/mpd/autoplay").expect(404);
    await request.post("/mpd/autoplay").send({ enabled: false }).expect(404);
  });
});
