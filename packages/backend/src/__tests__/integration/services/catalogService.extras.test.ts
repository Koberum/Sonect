import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { track, artist, album } from "@tests/factories/index.js";
import { CatalogServiceImpl } from "@services/library/catalogService.js";

describe("CatalogService extras (trophy)", () => {
  let close: () => void;
  let catalog: CatalogServiceImpl;
  beforeEach(() => {
    ({ close } = createTestDb());
    catalog = new CatalogServiceImpl();
  });
  afterEach(() => close());

  describe("searchTracks", () => {
    it("finds artists/albums/tracks case-insensitive and includes coverPreviews", () => {
      const a = artist.create({ name: "SearchArtist" }, 1);
      album.create({ title: "SearchAlbum", artistName: a.name }, 1);
      track.create(
        { title: "SearchTrack", artist: a.name, album: "SearchAlbum" },
        2,
      );
      const res = catalog.searchTracks("search");
      expect(res.artists.length).to.be.at.least(1);
      expect(res.albums.length).to.be.at.least(1);
      expect(res.tracks.length).to.be.at.least(1);
      for (const ar of res.artists) expect(ar.coverPreviews).to.be.an("array");
    });
    it("lowercases query before artist search", () => {
      artist.create({ name: "CaseArtist" }, 5);
      const lower = catalog.searchTracks("caseartist");
      const upper = catalog.searchTracks("CASEARTIST");
      expect(lower.artists).to.have.length(1);
      expect(upper.artists).to.have.length(1);
    });
    it("returns empty arrays when no match", () => {
      const res = catalog.searchTracks("nopeXYZ");
      expect(res.artists).to.deep.equal([]);
      expect(res.albums).to.deep.equal([]);
      expect(res.tracks).to.deep.equal([]);
    });
  });

  describe("getLibraryStats", () => {
    it("returns stats with lastSync null initially", () => {
      const s = catalog.getLibraryStats();
      expect(s.totalTracks).to.equal(0);
      expect(s.lastSync).to.be.null;
    });
    it("reflects seeded counts and duration", () => {
      track.create({ title: "T1", duration: 100 }, 10);
      track.create({ title: "T2", duration: 200 }, 11);
      const s = catalog.getLibraryStats();
      expect(s.totalTracks).to.equal(2);
      expect(s.totalDuration).to.equal(300);
    });
  });

  describe("getAlbumsByGenre edge", () => {
    it("returns [] on miss (covered) and found", () => {
      expect(catalog.getAlbumsByGenre("missing")).to.deep.equal([]);
      album.create({ title: "GAl", artistName: "GA", genreName: "Rock" }, 90);
      expect(catalog.getAlbumsByGenre("rock")).to.have.length(1);
    });
  });
});
