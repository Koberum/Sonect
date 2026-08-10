import { expect } from "chai";
import sinon from "sinon";
import esmock from "esmock";
import {
  createMockReq,
  createMockRes,
  createMockArtist,
  createMockAlbum,
  createMockTrack,
} from "../helpers.js";

describe("Library Controller", () => {
  let controller: any;

  const mockService = {
    getAllArtists: sinon.stub(),
    getArtistCount: sinon.stub(),
    getArtistById: sinon.stub(),
    getAllAlbums: sinon.stub(),
    getAlbumCount: sinon.stub(),
    getAlbumById: sinon.stub(),
    getAlbumsByArtist: sinon.stub(),
    getTracksByAlbum: sinon.stub(),
    getTracksByArtist: sinon.stub(),
    getAllTracks: sinon.stub(),
    getTrackCount: sinon.stub(),
    scanLibrary: sinon.stub(),
    scanImagesOnly: sinon.stub(),
  };

  beforeEach(async () => {
    sinon.resetHistory();
    mockService.getAllArtists.resolves([]);
    mockService.getArtistCount.resolves(0);
    mockService.getArtistById.resolves(undefined);
    mockService.getAllAlbums.resolves([]);
    mockService.getAlbumCount.resolves(0);
    mockService.getAlbumById.resolves(undefined);
    mockService.getAlbumsByArtist.resolves([]);
    mockService.getTracksByAlbum.resolves([]);
    mockService.getTracksByArtist.resolves([]);
    mockService.getAllTracks.resolves([]);
    mockService.getTrackCount.resolves(0);
    mockService.scanLibrary.resolves(undefined);
    mockService.scanImagesOnly.resolves(undefined);

    controller = await esmock(
      new URL("../../controllers/libraryController.ts", import.meta.url)
        .pathname,
      {},
      {
        "../../services/libraryService": mockService,
      },
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getArtists", () => {
    it("should return list of artists", async () => {
      const artists = [createMockArtist({ id: 1, name: "Artist A" })];
      mockService.getAllArtists.resolves(artists);
      mockService.getArtistCount.resolves(1);
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getArtists(req, res, next);

      expect(res.json.calledWith({ items: artists, total: 1 })).to.be.true;
    });

    it("should return 500 on service error", async () => {
      mockService.getAllArtists.rejects(new Error("DB error"));
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.getArtists(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].message).to.equal("DB error");
      } catch (err: any) {
        expect(err.message).to.equal("DB error");
      }
    });
  });

  describe("getArtistById", () => {
    it("should return artist when found", async () => {
      const artist = createMockArtist({ id: 1, name: "Artist A" });
      mockService.getArtistById.resolves(artist);
      const req = createMockReq({ params: { id: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getArtistById(req, res, next);

      expect(res.json.calledWith(artist)).to.be.true;
    });

    it("should return 404 when artist not found", async () => {
      const req = createMockReq({ params: { id: "999" } });
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.getArtistById(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].message).to.equal("Artist not found");
      } catch (err: any) {
        expect(err.message).to.equal("Artist not found");
      }
    });

    it("should return 500 on service error", async () => {
      mockService.getArtistById.rejects(new Error("DB error"));
      const req = createMockReq({ params: { id: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.getArtistById(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].message).to.equal("DB error");
      } catch (err: any) {
        expect(err.message).to.equal("DB error");
      }
    });
  });

  describe("getAlbums", () => {
    it("should return list of albums", async () => {
      const albums = [createMockAlbum({ id: 1, title: "Album A" })];
      mockService.getAllAlbums.resolves(albums);
      mockService.getAlbumCount.resolves(1);
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getAlbums(req, res, next);

      expect(res.json.calledWith({ items: albums, total: 1 })).to.be.true;
    });

    it("should return 500 on service error", async () => {
      mockService.getAllAlbums.rejects(new Error("Cover error"));
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.getAlbums(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].message).to.equal("Cover error");
      } catch (err: any) {
        expect(err.message).to.equal("Cover error");
      }
    });
  });

  describe("getAlbumById", () => {
    it("should return album when found", async () => {
      const album = createMockAlbum({ id: 1, title: "Album A" });
      mockService.getAlbumById.resolves(album);
      const req = createMockReq({ params: { id: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getAlbumById(req, res, next);

      expect(res.json.calledWith(album)).to.be.true;
    });

    it("should return 404 when album not found", async () => {
      const req = createMockReq({ params: { id: "999" } });
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.getAlbumById(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].message).to.equal("Album not found");
      } catch (err: any) {
        expect(err.message).to.equal("Album not found");
      }
    });

    it("should return 500 on service error", async () => {
      mockService.getAlbumById.rejects(new Error("DB error"));
      const req = createMockReq({ params: { id: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.getAlbumById(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].message).to.equal("DB error");
      } catch (err: any) {
        expect(err.message).to.equal("DB error");
      }
    });
  });

  describe("getAlbumsByArtist", () => {
    it("should return albums for a given artist", async () => {
      const albums = [createMockAlbum({ artist_id: 1 })];
      mockService.getAlbumsByArtist.resolves(albums);
      const req = createMockReq({ params: { artistId: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getAlbumsByArtist(req, res, next);

      expect(mockService.getAlbumsByArtist.calledWith(1)).to.be.true;
      expect(res.json.calledWith(albums)).to.be.true;
    });

    it("should return 500 on service error", async () => {
      mockService.getAlbumsByArtist.rejects(new Error("DB error"));
      const req = createMockReq({ params: { artistId: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.getAlbumsByArtist(req, res, next);
        expect(next.calledOnce).to.be.true;
      } catch (err: any) {
        expect(err.message).to.equal("DB error");
      }
    });
  });

  describe("getTracksByAlbum", () => {
    it("should return tracks for a given album", async () => {
      const tracks = [createMockTrack({ album_id: 1 })];
      mockService.getTracksByAlbum.resolves(tracks);
      const req = createMockReq({ params: { albumId: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getTracksByAlbum(req, res, next);

      expect(mockService.getTracksByAlbum.calledWith(1)).to.be.true;
      expect(res.json.calledWith(tracks)).to.be.true;
    });

    it("should return 500 on service error", async () => {
      mockService.getTracksByAlbum.rejects(new Error("Album not found"));
      const req = createMockReq({ params: { albumId: "999" } });
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.getTracksByAlbum(req, res, next);
        expect(next.calledOnce).to.be.true;
      } catch (err: any) {
        expect(err.message).to.equal("Album not found");
      }
    });
  });

  describe("getTracksByArtist", () => {
    it("should return tracks for a given artist", async () => {
      const tracks = [createMockTrack({ artist_id: 1 })];
      mockService.getTracksByArtist.resolves(tracks);
      const req = createMockReq({ params: { artistId: "1" } });
      const res = createMockRes();
      const next = sinon.stub();

      await controller.getTracksByArtist(req, res, next);

      expect(mockService.getTracksByArtist.calledWith(1)).to.be.true;
      expect(res.json.calledWith(tracks)).to.be.true;
    });

    it("should return 500 on service error", async () => {
      mockService.getTracksByArtist.rejects(new Error("Artist not found"));
      const req = createMockReq({ params: { artistId: "999" } });
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.getTracksByArtist(req, res, next);
        expect(next.calledOnce).to.be.true;
      } catch (err: any) {
        expect(err.message).to.equal("Artist not found");
      }
    });
  });

  describe("scanLibrary", () => {
    it("should trigger library scan", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.scanLibrary(req, res, next);

      expect(mockService.scanLibrary.calledOnce).to.be.true;
      expect(res.json.calledWith({ message: "Library scan completed" })).to.be
        .true;
    });

    it("should return 500 on scan error", async () => {
      mockService.scanLibrary.rejects(new Error("MPD error"));
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.scanLibrary(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].message).to.equal("MPD error");
      } catch (err: any) {
        expect(err.message).to.equal("MPD error");
      }
    });
  });

  describe("scanImagesOnly", () => {
    it("should trigger cover-only sync", async () => {
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      await controller.scanImagesOnly(req, res, next);

      expect(mockService.scanImagesOnly.calledOnce).to.be.true;
      expect(res.json.calledWith({ message: "Cover sync completed" })).to.be
        .true;
    });

    it("should return 500 on sync error", async () => {
      mockService.scanImagesOnly.rejects(new Error("Cover error"));
      const req = createMockReq();
      const res = createMockRes();
      const next = sinon.stub();

      try {
        await controller.scanImagesOnly(req, res, next);
        expect(next.calledOnce).to.be.true;
        expect(next.firstCall.args[0].message).to.equal("Cover error");
      } catch (err: any) {
        expect(err.message).to.equal("Cover error");
      }
    });
  });
});
