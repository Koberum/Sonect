import { expect } from "chai";
import sinon from "sinon";
import * as dbModule from "@repo/db";
import fs from "fs";
import path from "path";

describe("Library Service", () => {
  const coversDir = "/tmp/test-covers";
  let libraryService: any;

  const mockArtists = [
    { id: 1, name: "Artist A" },
    { id: 2, name: "Artist B" },
  ];

  const mockAlbums = [
    { id: 1, title: "Album A", artist_id: 1, cover_path: "hash1.jpg" },
    { id: 2, title: "Album B", artist_id: 2, cover_path: null },
  ];

  const mockTracks = [
    {
      id: 1,
      file: "test.mp3",
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
    process.env.COVERS_DIR = coversDir;
    sinon.resetHistory();

    sinon.stub(fs, "existsSync").returns(true);
    sinon.stub(fs, "mkdirSync").returns(undefined);

    sinon.stub(dbModule.artistsDb, "getAll").returns(mockArtists);
    sinon
      .stub(dbModule.artistsDb, "getById")
      .callsFake((id: number) => mockArtists.find((a) => a.id === id));
    sinon.stub(dbModule.albumsDb, "getAll").returns(mockAlbums);
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

    libraryService = await import("../../services/libraryService.ts");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getAllArtists", () => {
    it("should return all artists from the database", async () => {
      const artists = await libraryService.getAllArtists();
      expect(artists).to.deep.equal([
        { ...mockArtists[0], coverPreviews: ["hash1.jpg"] },
        { ...mockArtists[1], coverPreviews: [] },
      ]);
    });
  });

  describe("getArtistById", () => {
    it("should return artist by id", async () => {
      const artist = await libraryService.getArtistById(1);
      expect(artist).to.deep.equal(mockArtists[0]);
    });

    it("should return undefined for non-existent artist", async () => {
      const artist = await libraryService.getArtistById(999);
      expect(artist).to.be.undefined;
    });
  });

  describe("getAlbumById", () => {
    it("should return album with artist name and cover path", async () => {
      const album = await libraryService.getAlbumById(1);
      expect(album).to.include({
        id: 1,
        title: "Album A",
        artist_name: "Artist A",
        cover_path: "hash1.jpg",
      });
    });

    it("should return undefined for non-existent album", async () => {
      const album = await libraryService.getAlbumById(999);
      expect(album).to.be.undefined;
    });
  });

  describe("getAlbumsByArtist", () => {
    it("should return albums for a given artist", async () => {
      const albums = await libraryService.getAlbumsByArtist(1);
      expect(albums).to.have.length(1);
      expect(albums[0].title).to.equal("Album A");
    });

    it("should return empty array for artist with no albums", async () => {
      const albums = await libraryService.getAlbumsByArtist(999);
      expect(albums).to.deep.equal([]);
    });
  });

  describe("getTracksByAlbum", () => {
    it("should return tracks for a valid album", async () => {
      const tracks = await libraryService.getTracksByAlbum(1);
      expect(tracks).to.have.length(1);
      expect(tracks[0]).to.include({
        title: "Track 1",
        artist_name: "Artist A",
      });
    });

    it("should throw for non-existent album", async () => {
      (dbModule.albumsDb.getById as sinon.SinonStub).returns(undefined);
      try {
        await libraryService.getTracksByAlbum(999);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).to.equal("Album not found");
      }
    });
  });

  describe("getTracksByArtist", () => {
    it("should return tracks for a valid artist", async () => {
      const tracks = await libraryService.getTracksByArtist(1);
      expect(tracks).to.have.length(1);
      expect(tracks[0].title).to.equal("Track 1");
    });

    it("should throw for non-existent artist", async () => {
      (dbModule.artistsDb.getById as sinon.SinonStub).returns(undefined);
      try {
        await libraryService.getTracksByArtist(999);
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).to.equal("Artist not found");
      }
    });
  });

  describe("mapDbTrackToTrack", () => {
    it("should map a DBTrack to a Track with artist name and cover", () => {
      const result = libraryService.mapDbTrackToTrack(
        mockTracks[0],
        mockArtists[0],
        mockAlbums[0],
      );
      expect(result).to.deep.equal({
        id: 1,
        title: "Track 1",
        track_number: 1,
        disc_number: 1,
        duration: 180,
        date: "2020",
        genre: "Rock",
        file: "test.mp3",
        artist_id: 1,
        album_id: 1,
        artist_name: "Artist A",
        cover_path: "hash1.jpg",
        album_name: "Album A",
      });
    });

    it("should handle missing artist and album gracefully", () => {
      const result = libraryService.mapDbTrackToTrack(mockTracks[0]);
      expect(result.artist_name).to.equal("");
      expect(result.cover_path).to.equal("");
    });
  });
});
