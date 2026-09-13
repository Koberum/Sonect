import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { seedCatalog } from "@tests/helpers/seed.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { genre } from "@tests/factories/genre.js";
import { tracksDb } from "@repo/db";
import { CatalogServiceImpl } from "@services/library/catalogService.js";

// Trophy middle layer: service + real :memory: DB, no mocks
// Fresh DB per it via single outer beforeEach — no per-method beforeEach needed
describe("CatalogService (trophy integration)", () => {
  let close: () => void;
  let catalog: CatalogServiceImpl;

  beforeEach(() => {
    ({ close } = createTestDb());
    catalog = new CatalogServiceImpl();
  });

  afterEach(() => close());

  describe("getAllArtists", () => {
    it("returns [] when empty", () => {
      expect(catalog.getAllArtists()).to.deep.equal([]);
      expect(catalog.getArtistCount()).to.equal(0);
    });

    it("returns artists with coverPreviews ≤4 and no empty strings (withCovers)", () => {
      seedCatalog({
        artists: 2,
        albumsPerArtist: 2,
        tracksPerAlbum: 1,
        withCovers: true,
        seed: 42,
      });
      const artists = catalog.getAllArtists();
      expect(artists).to.have.length(2);
      for (const a of artists) {
        expect(a.coverPreviews).to.be.an("array");
        expect(a.coverPreviews!.length).to.be.at.most(4);
        for (const cp of a.coverPreviews!)
          expect(cp).to.be.a("string").that.is.not.empty;
      }
    });

    it("paginates via limit/offset still with previews", () => {
      seedCatalog({
        artists: 5,
        albumsPerArtist: 1,
        tracksPerAlbum: 1,
        withCovers: true,
        seed: 7,
      });
      const all = catalog.getAllArtists();
      expect(all).to.have.length(5);
      const page1 = catalog.getAllArtists(2, 0);
      const page2 = catalog.getAllArtists(2, 2);
      expect(page1).to.have.length(2);
      expect(page2).to.have.length(2);
      const namesAll = all.map((a) => a.name);
      expect(page1[0].name).to.equal(namesAll[0]);
      expect(page2[0].name).to.equal(namesAll[2]);
    });

    it("orders asc(name)", () => {
      seedCatalog({
        artists: 3,
        albumsPerArtist: 1,
        tracksPerAlbum: 1,
        seed: 99,
      });
      const artists = catalog.getAllArtists();
      const names = artists.map((a) => a.name);
      expect(names).to.deep.equal(
        [...names].sort((a, b) => a.localeCompare(b)),
      );
    });
  });

  describe("getArtistCount", () => {
    it("returns 0 when empty", () => {
      expect(catalog.getArtistCount()).to.equal(0);
    });
    it("reflects seeded count", () => {
      seedCatalog({
        artists: 3,
        albumsPerArtist: 1,
        tracksPerAlbum: 1,
        seed: 10,
      });
      expect(catalog.getArtistCount()).to.equal(3);
    });
  });

  describe("getArtistById", () => {
    it("returns undefined on miss", () => {
      expect(catalog.getArtistById(99999)).to.be.undefined;
    });
    it("returns found artist", () => {
      const a = artist.create({ name: "LookupArtist" }, 1);
      expect(catalog.getArtistById(a.id)?.name).to.equal("LookupArtist");
    });
  });

  describe("getAlbumsByArtist", () => {
    it("returns [] on missing artist", () => {
      expect(catalog.getAlbumsByArtist(99999)).to.deep.equal([]);
    });
    it("returns ordered by year asc on found", () => {
      const a = artist.create({ name: "YearArtist" }, 20);
      album.create({ title: "B", artistName: a.name, year: 2005 }, 20);
      album.create({ title: "A", artistName: a.name, year: 2005 }, 21);
      album.create({ title: "C", artistName: a.name, year: 1999 }, 22);
      expect(catalog.getAlbumsByArtist(a.id).map((x) => x.title)).to.deep.equal(
        ["C", "A", "B"],
      );
    });
  });

  describe("getAllAlbums", () => {
    it("returns [] when empty", () => {
      expect(catalog.getAllAlbums()).to.deep.equal([]);
    });
    it("sorts found: year desc, recent desc, default title asc + pagination guard", () => {
      const a = artist.create({ name: "SortArtist" }, 30);
      album.create({ title: "Zebra", artistName: a.name, year: 1999 }, 30);
      album.create({ title: "Alpha", artistName: a.name, year: 2020 }, 31);
      album.create({ title: "Middle", artistName: a.name, year: 2005 }, 32);
      const byYear = catalog.getAllAlbums("year");
      expect(byYear.map((x) => `${x.year}-${x.title}`)).to.deep.equal([
        "2020-Alpha",
        "2005-Middle",
        "1999-Zebra",
      ]);
      const byTitle = catalog.getAllAlbums();
      expect(byTitle.map((x) => x.title)).to.deep.equal(
        ["Alpha", "Middle", "Zebra"].sort(),
      );
      const byRecent = catalog.getAllAlbums("recent");
      expect(byRecent).to.have.length(3);
      // pagination guard: offset without limit ignored -> returns all
      expect(catalog.getAllAlbums(undefined, undefined, 5)).to.have.length(3);
      expect(catalog.getAllAlbums(undefined, 1, 1)).to.have.length(1);
    });
  });

  describe("getAlbumCount", () => {
    it("returns 0 when empty", () => {
      expect(catalog.getAlbumCount()).to.equal(0);
    });
    it("reflects seeded count", () => {
      seedCatalog({
        artists: 2,
        albumsPerArtist: 3,
        tracksPerAlbum: 0,
        seed: 11,
      });
      expect(catalog.getAlbumCount()).to.equal(6);
    });
  });

  describe("getRecentlyAddedAlbums", () => {
    it("returns [] when empty", () => {
      expect(catalog.getRecentlyAddedAlbums(2)).to.deep.equal([]);
    });
    it("respects limit", () => {
      for (let i = 0; i < 5; i++)
        album.create(
          { title: `RecAl${i}`, artistName: `RAlArtist${i}` },
          40 + i,
        );
      expect(catalog.getRecentlyAddedAlbums(2)).to.have.length(2);
      expect(catalog.getRecentlyAddedAlbums()).to.have.length(5);
    });
  });

  describe("getAlbumById", () => {
    it("returns undefined on miss", () => {
      expect(catalog.getAlbumById(99999)).to.be.undefined;
    });
    it("returns found with enrichment", () => {
      const al = album.create(
        { title: "ByIdAl", artistName: "ByIdArtist" },
        11,
      );
      const found = catalog.getAlbumById(al.id);
      expect(found?.title).to.equal("ByIdAl");
      expect(found?.artist_name).to.equal("ByIdArtist");
    });
  });

  describe("updateAlbumCoverPath", () => {
    it("no throw on missing id", () => {
      const before = catalog.getAlbumCount();
      catalog.updateAlbumCoverPath(99999, "covers/y.jpg");
      expect(catalog.getAlbumCount()).to.equal(before);
    });
    it("persists cover_path on found", () => {
      const al = album.create(
        { title: "CoverAl", artistName: "CoverArtist" },
        50,
      );
      catalog.updateAlbumCoverPath(al.id, "covers/x.jpg");
      expect(catalog.getAlbumById(al.id)?.cover_path).to.equal("covers/x.jpg");
    });
  });

  describe("getAlbumsByGenre", () => {
    it("returns [] on miss", () => {
      expect(catalog.getAlbumsByGenre("nonexistent")).to.deep.equal([]);
    });
    it("returns found case-insensitive", () => {
      album.create(
        { title: "G1", artistName: "GA", genreName: "Shoegaze" },
        60,
      );
      expect(catalog.getAlbumsByGenre("shoegaze")).to.have.length(1);
      expect(catalog.getAlbumsByGenre("SHOEGAZE")).to.have.length(1);
    });
  });

  describe("getGenres", () => {
    it("returns [] when empty", () => {
      expect(catalog.getGenres()).to.deep.equal([]);
    });
    it("orders asc(name) on found", () => {
      genre.create({ name: "Zebra" }, 70);
      genre.create({ name: "Alpha" }, 71);
      expect(catalog.getGenres().map((g) => g.name)).to.deep.equal([
        "Alpha",
        "Zebra",
      ]);
    });
  });

  describe("getGenreById", () => {
    it("returns undefined on miss", () => {
      expect(catalog.getGenreById(99999)).to.be.undefined;
    });
    it("returns found", () => {
      const g = genre.create({ name: "FoundGenre" }, 80);
      expect(catalog.getGenreById(g.id)?.name).to.equal("FoundGenre");
    });
  });

  describe("getById", () => {
    it("returns undefined on miss", () => {
      expect(catalog.getById(99999)).to.be.undefined;
    });
    it("alias equivalence to getGenreById", () => {
      const g = genre.create({ name: "AliasTest" }, 81);
      expect(catalog.getById(g.id)?.name).to.equal("AliasTest");
      expect(catalog.getById(g.id)).to.deep.equal(catalog.getGenreById(g.id));
    });
  });

  describe("getTracksByAlbum", () => {
    it("throws on missing album", () => {
      expect(() => catalog.getTracksByAlbum(99999)).to.throw("Album not found");
    });
    it("returns found enriched and ordered disc/track/title", () => {
      const al = album.create(
        { title: "EnrichAl", artistName: "EnrichArtist" },
        100,
      );
      track.create(
        { album: al.title, artist: "EnrichArtist", title: "T1" },
        101,
      );
      const tracks = catalog.getTracksByAlbum(al.id);
      expect(tracks).to.have.length(1);
      expect(
        (tracks[0] as unknown as { album_name: string }).album_name,
      ).to.equal(al.title);
      expect(tracks[0].cover_path).to.be.a("string");

      const al2 = album.create(
        { title: "OrderAl", artistName: "OrderArtist" },
        110,
      );
      track.create(
        {
          album: al2.title,
          artist: "OrderArtist",
          title: "B",
          track: 2,
          disc: "1",
        },
        111,
      );
      track.create(
        {
          album: al2.title,
          artist: "OrderArtist",
          title: "A",
          track: 1,
          disc: "1",
        },
        112,
      );
      expect(
        catalog.getTracksByAlbum(al2.id).map((t) => t.title),
      ).to.deep.equal(["A", "B"]);
    });
  });

  describe("getTracksByArtist", () => {
    it("throws on missing artist", () => {
      expect(() => catalog.getTracksByArtist(99999)).to.throw(
        "Artist not found",
      );
    });
    it("returns title asc on found and [] when no tracks", () => {
      const a = artist.create({ name: "TArtist" }, 120);
      const al = album.create({ title: "TAl", artistName: a.name }, 120);
      track.create({ artist: a.name, album: al.title, title: "Zeta" }, 121);
      track.create({ artist: a.name, album: al.title, title: "Alpha" }, 122);
      expect(catalog.getTracksByArtist(a.id).map((t) => t.title)).to.deep.equal(
        ["Alpha", "Zeta"],
      );
      const emptyArtist = artist.create({ name: "EmptyArtist" }, 123);
      expect(catalog.getTracksByArtist(emptyArtist.id)).to.deep.equal([]);
    });
  });

  describe("getAllTracks", () => {
    it("returns [] when empty", () => {
      expect(catalog.getAllTracks()).to.deep.equal([]);
    });
    it("sorts found and pagination guard + orphan inclusion", () => {
      const a = artist.create({ name: "SortTArtist" }, 130);
      const al = album.create({ title: "SortTAl", artistName: a.name }, 130);
      track.create(
        { artist: a.name, album: al.title, title: "Short", duration: 10 },
        131,
      );
      track.create(
        { artist: a.name, album: al.title, title: "Long", duration: 300 },
        132,
      );
      expect(catalog.getAllTracks("duration")[0].title).to.equal("Long");
      expect(catalog.getAllTracks().map((t) => t.title)).to.deep.equal(
        ["Long", "Short"].sort(),
      );
      expect(catalog.getAllTracks(undefined, undefined, 5)).to.have.length(2);
      expect(catalog.getAllTracks(undefined, 1, 1)).to.have.length(1);
      // orphan via leftJoin included in getAllTracks
      const orphanId = tracksDb.upsert({
        file: "orphan.mp3",
        title: "Orphan",
        artist: "",
        album: "",
      } as never);
      expect(catalog.getAllTracks().some((t) => t.id === orphanId)).to.be.true;
    });
  });

  describe("getTrackCount", () => {
    it("returns 0 when empty", () => {
      expect(catalog.getTrackCount()).to.equal(0);
    });
    it("reflects seeded count", () => {
      track.create({ title: "FindMe" }, 90);
      expect(catalog.getTrackCount()).to.equal(1);
    });
  });

  describe("getTrackById", () => {
    it("returns undefined on miss", () => {
      expect(catalog.getTrackById(99999)).to.be.undefined;
    });
    it("returns found and orphan undefined via innerJoin", () => {
      const t = track.create({ title: "FindMe2" }, 91);
      expect(catalog.getTrackById(t.id)?.title).to.equal("FindMe2");
      const orphanId = tracksDb.upsert({
        file: "orphan2.mp3",
        title: "Orphan2",
        artist: "",
        album: "",
      } as never);
      expect(catalog.getTrackById(orphanId)).to.be.undefined;
    });
  });

  describe("resolveTrack", () => {
    it("returns null on miss", () => {
      expect(catalog.resolveTrack("Nobody", "Nowhere", "Nothing")).to.be.null;
      expect(catalog.resolveTrack("The Beatles", "abbey road", "Come Together"))
        .to.be.null;
      expect(catalog.resolveTrack("The Beatles", "Abbey Road", "come together"))
        .to.be.null;
    });
    it("returns found with mixed collation (artist NOCASE, album/title case-sensitive)", () => {
      track.create(
        { artist: "The Beatles", album: "Abbey Road", title: "Come Together" },
        150,
      );
      expect(
        catalog.resolveTrack("the beatles", "Abbey Road", "Come Together")
          ?.title,
      ).to.equal("Come Together");
    });
  });

  describe("getTracksByGenre", () => {
    it("returns [] on miss/partial", () => {
      expect(catalog.getTracksByGenre("nonexistent")).to.deep.equal([]);
      expect(catalog.getTracksByGenre("shoe")).to.deep.equal([]);
    });
    it("returns found case-insensitive exact and ordered title asc", () => {
      track.create(
        { title: "G1", artist: "GA1", album: "GA", genre: "Shoegaze" },
        160,
      );
      track.create(
        { title: "G0", artist: "GA2", album: "GA2", genre: "Shoegaze" },
        161,
      );
      expect(
        catalog.getTracksByGenre("shoegaze").map((t) => t.title),
      ).to.deep.equal(["G0", "G1"]);
      expect(catalog.getTracksByGenre("SHOEGAZE")).to.have.length(2);
    });
  });

  describe("getRecentlyAddedTracks", () => {
    it("returns [] when empty", () => {
      expect(catalog.getRecentlyAddedTracks(2)).to.deep.equal([]);
    });
    it("respects limit", () => {
      for (let i = 0; i < 5; i++)
        track.create({ title: `RecT${i}`, artist: `RArtist${i}` }, 140 + i);
      expect(catalog.getRecentlyAddedTracks(2)).to.have.length(2);
      expect(catalog.getRecentlyAddedTracks()).to.have.length(5);
    });
  });

  describe("getRecentlyAddedAlbums", () => {
    it("returns [] when empty", () => {
      expect(catalog.getRecentlyAddedAlbums(2)).to.deep.equal([]);
    });
    it("respects limit", () => {
      for (let i = 0; i < 5; i++)
        album.create(
          { title: `RecAl${i}`, artistName: `RAlArtist${i}` },
          45 + i,
        );
      expect(catalog.getRecentlyAddedAlbums(2)).to.have.length(2);
    });
  });
});
