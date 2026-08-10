import { expect } from "chai";
import sinon from "sinon";
import express from "express";
import supertest from "supertest";
import * as dbModule from "@repo/db";
import { errorHandler } from "../../middleware/errorHandler";

describe("Dashboard Routes", () => {
  let request: supertest.SuperTest<supertest.Test>;

  beforeEach(async () => {
    sinon.resetHistory();

    sinon.stub(dbModule.albumsDb, "getRecentAlbums").returns([]);
    sinon.stub(dbModule.tracksDb, "getRecentlyPlayed").returns([]);
    sinon.stub(dbModule.tracksDb, "getTopTracks").returns([]);
    sinon.stub(dbModule.tracksDb, "getTopGenres").returns([]);
    sinon.stub(dbModule.tracksDb, "getTopArtists").returns([]);
    sinon.stub(dbModule.tracksDb, "getTracksForDiscovery").returns([]);
    sinon.stub(dbModule.tracksDb, "getTopGenre").returns(null);
    sinon.stub(dbModule.tracksDb, "getTracksByGenre").returns([]);

    const { default: dashboardRoutes } =
      await import("../../routes/dashboardRoutes.ts");

    const app = express();
    app.use(express.json());
    app.use("/dashboard", dashboardRoutes);
    app.use(errorHandler);
    request = supertest(app) as any;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("GET /dashboard", () => {
    it("should respond with 200 and dashboard data shape", async () => {
      const res = await request.get("/dashboard").expect(200);

      expect(res.body).to.have.all.keys(
        "continueListening",
        "recentlyPlayed",
        "topTracks",
        "suggestedTracks",
        "genreQuickMix",
      );
      expect(res.body.continueListening).to.be.an("array");
      expect(res.body.recentlyPlayed).to.be.an("array");
      expect(res.body.topTracks).to.be.an("array");
      expect(res.body.suggestedTracks).to.be.an("array");
      expect(res.body.genreQuickMix).to.be.null;
    });

    it("should pass excludeAlbum query param to getRecentAlbums", async () => {
      await request.get("/dashboard?excludeAlbum=42").expect(200);

      sinon.assert.calledWith(
        dbModule.albumsDb.getRecentAlbums as sinon.SinonStub,
        10,
        42,
      );
    });

    it("should pass undefined excludeAlbum when query param omitted", async () => {
      await request.get("/dashboard").expect(200);

      sinon.assert.calledWith(
        dbModule.albumsDb.getRecentAlbums as sinon.SinonStub,
        10,
        undefined,
      );
    });

    it("should return genreQuickMix with tracks when top genre exists", async () => {
      (dbModule.tracksDb.getTopGenre as sinon.SinonStub).returns("Rock");
      (dbModule.tracksDb.getTracksByGenre as sinon.SinonStub).returns([
        { id: 1, title: "Song 1", genre: "Rock" },
      ] as any);

      const res = await request.get("/dashboard").expect(200);

      expect(res.body.genreQuickMix).to.deep.equal({
        genre: "Rock",
        tracks: [{ id: 1, title: "Song 1", genre: "Rock" }],
      });
    });
  });

  it("should return 404 for unknown routes under /dashboard", async () => {
    await request.get("/dashboard/unknown").expect(404);
  });
});
