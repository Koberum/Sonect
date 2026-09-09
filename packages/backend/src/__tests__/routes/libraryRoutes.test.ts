import { expect } from "chai";
import sinon from "sinon";
import express from "express";
import supertest from "supertest";
import * as dbModule from "@repo/db";
import fs from "fs";
import { mpdConnectionManager } from "../../services/mpdConnectionManager";
import { errorHandler } from "../../middleware/errorHandler";
import { MpdSyncService } from "../../services/mpdSyncService";
import { CoverService } from "../../services/coverService";

describe("Library Routes", () => {
  let request: supertest.SuperTest<supertest.Test>;

  const mockArtists = [
    { id: 1, name: "Artist A" },
    { id: 2, name: "Artist B" },
  ];

  const mockAlbums = [
    {
      id: 1,
      title: "Album A",
      artist_id: 1,
      cover_path: "abc.jpg",
      year: 2020,
      artist_name: "Artist A",
      genre: "Rock",
    },
    {
      id: 2,
      title: "Album B",
      artist_id: 2,
      cover_path: undefined,
      year: 2021,
      artist_name: "Artist B",
      genre: "Pop",
    },
  ];

  const mockTracks = [
    {
      id: 1,
      file: "song1.mp3",
      title: "Track 1",
      artist_id: 1,
      album_id: 1,
      track_number: 1,
      disc_number: 1,
      duration: 180,
      date: "2020",
      genre: "Rock",
    },
  ];

  beforeEach(async () => {
    process.env.COVERS_DIR = "/tmp/covers";
    sinon.resetHistory();

    sinon.stub(dbModule.artistsDb, "getAll").returns(mockArtists);
    sinon.stub(dbModule.artistsDb, "count").returns(mockArtists.length);
    sinon
      .stub(dbModule.artistsDb, "getById")
      .callsFake((id: number) => mockArtists.find((a) => a.id === id));
    sinon.stub(dbModule.albumsDb, "getAll").returns(mockAlbums);
    sinon.stub(dbModule.albumsDb, "count").returns(mockAlbums.length);
    sinon
      .stub(dbModule.albumsDb, "getById")
      .callsFake((id: number) => mockAlbums.find((a) => a.id === id));
    sinon
      .stub(dbModule.albumsDb, "getByArtist")
      .callsFake((artistId: number) =>
        mockAlbums.filter((a) => a.artist_id === artistId),
      );
    sinon
      .stub(dbModule.albumsDb, "getCoverPreviews")
      .callsFake((artistId: number) =>
        mockAlbums
          .filter((a) => a.artist_id === artistId && a.cover_path)
          .map((a) => a.cover_path!),
      );
    sinon
      .stub(dbModule.tracksDb, "getByAlbum")
      .callsFake((albumId: number) =>
        mockTracks.filter((t) => t.album_id === albumId),
      );
    sinon
      .stub(dbModule.tracksDb, "getByArtist")
      .callsFake((artistId: number) =>
        mockTracks.filter((t) => t.artist_id === artistId),
      );
    sinon.stub(mpdConnectionManager, "executeCommand").resolves("");
    sinon.stub(mpdConnectionManager, "getCmdClient").returns({
      on: sinon.stub(),
      off: sinon.stub(),
    } as any);
    sinon.stub(fs, "existsSync").returns(true);
    sinon.stub(dbModule.syncMetadataDb, "setLastSync").returns(undefined);
    sinon.stub(dbModule.syncMetadataDb, "getLastSync").returns(undefined);
    sinon.stub(MpdSyncService.prototype, "syncAll").resolves();
    sinon.stub(CoverService.prototype, "syncAllCovers").resolves();

    const { default: libraryRoutes } =
      await import("../../routes/libraryRoutes.ts");

    const app = express();
    app.use(express.json());
    app.use("/library", libraryRoutes);
    app.use(errorHandler);
    request = supertest(app) as any;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("GET /library/artists", () => {
    it("should return list of artists", async () => {
      const res = await request.get("/library/artists").expect(200);
      expect(res.body).to.deep.equal({
        items: [
          { ...mockArtists[0], coverPreviews: ["abc.jpg"] },
          { ...mockArtists[1], coverPreviews: [] },
        ],
        total: mockArtists.length,
      });
    });
  });

  describe("GET /library/artists/:id", () => {
    it("should return artist by id", async () => {
      const res = await request.get("/library/artists/1").expect(200);
      expect(res.body).to.deep.equal(mockArtists[0]);
    });

    it("should return 404 for non-existent artist", async () => {
      const res = await request.get("/library/artists/999").expect(404);
      expect(res.body).to.deep.equal({ error: "Artist not found" });
    });
  });

  describe("GET /library/albums", () => {
    it("should return list of albums", async () => {
      const res = await request.get("/library/albums").expect(200);
      expect(res.body).to.be.an("object");
      expect(res.body.items).to.be.an("array");
    });
  });

  describe("GET /library/albums/:id", () => {
    it("should return album by id", async () => {
      const res = await request.get("/library/albums/1").expect(200);
      expect(res.body).to.include({ id: 1, title: "Album A" });
    });

    it("should return 404 for non-existent album", async () => {
      const res = await request.get("/library/albums/999").expect(404);
      expect(res.body).to.deep.equal({ error: "Album not found" });
    });
  });

  describe("GET /library/albums/:albumId/tracks", () => {
    it("should return tracks for an album", async () => {
      const res = await request.get("/library/albums/1/tracks").expect(200);
      expect(res.body).to.be.an("array");
    });
  });

  describe("GET /library/artists/:artistId/albums", () => {
    it("should return albums for an artist", async () => {
      const res = await request.get("/library/artists/1/albums").expect(200);
      expect(res.body).to.have.length(1);
    });
  });

  describe("GET /library/artists/:artistId/tracks", () => {
    it("should return tracks for an artist", async () => {
      const res = await request.get("/library/artists/1/tracks").expect(200);
      expect(res.body).to.have.length(1);
    });
  });

  describe("POST /library/scan", () => {
    it("should trigger a library scan", async () => {
      const res = await request.post("/library/scan").expect(200);
      expect(res.body).to.deep.equal({ message: "Library scan completed" });
    });
  });

  describe("POST /library/sync-images", () => {
    it("should trigger cover-only sync", async () => {
      const res = await request.post("/library/sync-images").expect(200);
      expect(res.body).to.deep.equal({ message: "Cover sync completed" });
    });
  });

  it("should return 404 for unknown routes under /library", async () => {
    await request.get("/library/unknown").expect(404);
  });
});
