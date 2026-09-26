import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { albumsDb, artistsDb, genresDb, tracksDb } from "@repo/db";
import { db } from "@repo/db";
import { tracks, albums } from "@repo/db";
import { eq } from "drizzle-orm";

describe("albumsDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  describe("findOrCreate", () => {
    it("creates with artist and year", () => {
      const artistId = artistsDb.findOrCreate("ArtistA");
      const id = albumsDb.findOrCreate("AlbumX", artistId, 1999);
      const row = albumsDb.getById(id);
      expect(row?.title).to.equal("AlbumX");
      expect(row?.artist_name).to.equal("ArtistA");
      expect(row?.year).to.equal(1999);
    });
    it("NOCASE dedup on title", () => {
      const a = albumsDb.findOrCreate("Abbey Road");
      const b = albumsDb.findOrCreate("abbey road");
      expect(a).to.equal(b);
      expect(albumsDb.count()).to.equal(1);
    });
    it("reassigns artist when different artistId supplied", () => {
      const a1 = artistsDb.findOrCreate("Artist1");
      const a2 = artistsDb.findOrCreate("Artist2");
      const id = albumsDb.findOrCreate("SameTitle", a1);
      const id2 = albumsDb.findOrCreate("SameTitle", a2);
      expect(id).to.equal(id2);
      expect(albumsDb.getById(id)?.artist_name).to.equal("Artist2");
    });
    it("fills genre only when NULL", () => {
      const g1 = genresDb.findOrCreate("Rock");
      const g2 = genresDb.findOrCreate("Pop");
      const id = albumsDb.findOrCreate("GAlbum", undefined, undefined, g1);
      expect(albumsDb.getById(id)?.genre).to.equal("Rock");
      // second call with different genre should NOT overwrite existing genre
      albumsDb.findOrCreate("GAlbum", undefined, undefined, g2);
      expect(albumsDb.getById(id)?.genre).to.equal("Rock");
    });
    it("fills genre when previous NULL via string genre", () => {
      const id = albumsDb.findOrCreate("NoGenreAlbum");
      expect(albumsDb.getById(id)?.genre ?? undefined).to.be.undefined;
      albumsDb.findOrCreate("NoGenreAlbum", undefined, undefined, "Jazz");
      expect(albumsDb.getById(id)?.genre).to.equal("Jazz");
    });
    it("accepts numeric genreId", () => {
      const gid = genresDb.findOrCreate("Electronic");
      const id = albumsDb.findOrCreate("NumGenre", undefined, undefined, gid);
      expect(albumsDb.getById(id)?.genre).to.equal("Electronic");
    });
    it("trims empty genre string → no genre", () => {
      const id = albumsDb.findOrCreate(
        "EmptyGenre",
        undefined,
        undefined,
        "   ",
      );
      expect(albumsDb.getById(id)?.genre ?? undefined).to.be.undefined;
    });
  });

  describe("getAll", () => {
    it("returns [] when empty", () =>
      expect(albumsDb.getAll()).to.deep.equal([]));
    it("orders year desc then title asc when sort=year", () => {
      const a = artistsDb.findOrCreate("A");
      albumsDb.findOrCreate("Zebra", a, 1999);
      albumsDb.findOrCreate("Alpha", a, 2020);
      albumsDb.findOrCreate("Middle", a, 2005);
      const byYear = albumsDb.getAll({ sort: "year" });
      expect(byYear.map((x) => `${x.year}-${x.title}`)).to.deep.equal([
        "2020-Alpha",
        "2005-Middle",
        "1999-Zebra",
      ]);
    });
    it("orders recent desc when sort=recent", () => {
      const id1 = albumsDb.findOrCreate("First");
      const id2 = albumsDb.findOrCreate("Second");
      // Force distinct created_at to avoid second-resolution flake
      db()
        .update(albums)
        .set({ created_at: "2020-01-01 00:00:00" })
        .where(eq(albums.id, id1))
        .run();
      db()
        .update(albums)
        .set({ created_at: "2020-01-02 00:00:00" })
        .where(eq(albums.id, id2))
        .run();
      const recent = albumsDb.getAll({ sort: "recent" });
      expect(recent[0].title).to.equal("Second");
    });
    it("default orders title asc", () => {
      const a = artistsDb.findOrCreate("A");
      albumsDb.findOrCreate("Zebra", a);
      albumsDb.findOrCreate("Alpha", a);
      expect(albumsDb.getAll().map((x) => x.title)).to.deep.equal([
        "Alpha",
        "Zebra",
      ]);
    });
    it("pagination guard: offset without limit ignored", () => {
      for (let i = 0; i < 5; i++) albumsDb.findOrCreate(`Al${i}`);
      expect(albumsDb.getAll({ offset: 2 } as never)).to.have.length(5);
      expect(albumsDb.getAll({ limit: 2, offset: 1 })).to.have.length(2);
    });
  });

  describe("count / getRecent / getById", () => {
    it("count 0 when empty", () => expect(albumsDb.count()).to.equal(0));
    it("count reflects inserts", () => {
      albumsDb.findOrCreate("One");
      albumsDb.findOrCreate("Two");
      expect(albumsDb.count()).to.equal(2);
    });
    it("getRecent returns latest first", () => {
      const id1 = albumsDb.findOrCreate("Old");
      const id2 = albumsDb.findOrCreate("New");
      db()
        .update(albums)
        .set({ created_at: "2020-01-01 00:00:00" })
        .where(eq(albums.id, id1))
        .run();
      db()
        .update(albums)
        .set({ created_at: "2020-01-02 00:00:00" })
        .where(eq(albums.id, id2))
        .run();
      const recent = albumsDb.getRecent(1);
      expect(recent[0].title).to.equal("New");
    });
    it("getById miss → undefined", () =>
      expect(albumsDb.getById(99999)).to.be.undefined);
    it("getById found includes artist_name and genre", () => {
      const gid = genresDb.findOrCreate("Rock");
      const aid = artistsDb.findOrCreate("ArtistX");
      const id = albumsDb.findOrCreate("FoundAl", aid, undefined, gid);
      const row = albumsDb.getById(id);
      expect(row?.artist_name).to.equal("ArtistX");
      expect(row?.genre).to.equal("Rock");
    });
    it("getById for artistless album returns empty artist_name", () => {
      const id = albumsDb.findOrCreate("NoArtistAl");
      expect(albumsDb.getById(id)?.artist_name).to.equal("");
    });
  });

  describe("getByGenre / getByArtist / search / getCoverPreviews", () => {
    it("getByGenre case-insensitive", () => {
      const gid = genresDb.findOrCreate("Shoegaze");
      albumsDb.findOrCreate("G1", undefined, undefined, gid);
      expect(albumsDb.getByGenre("shoegaze")).to.have.length(1);
      expect(albumsDb.getByGenre("SHOEGAZE")).to.have.length(1);
      expect(albumsDb.getByGenre("missing")).to.deep.equal([]);
    });
    it("getByArtist orders year asc then title asc", () => {
      const aid = artistsDb.findOrCreate("YearArtist");
      albumsDb.findOrCreate("B", aid, 2005);
      albumsDb.findOrCreate("A", aid, 2005);
      albumsDb.findOrCreate("C", aid, 1999);
      expect(albumsDb.getByArtist(aid).map((x) => x.title)).to.deep.equal([
        "C",
        "A",
        "B",
      ]);
    });
    it("getByArtist empty for unknown", () =>
      expect(albumsDb.getByArtist(99999)).to.deep.equal([]));
    it("search finds album title or artist name", () => {
      const aid = artistsDb.findOrCreate("Beatles");
      albumsDb.findOrCreate("Abbey Road", aid);
      expect(albumsDb.search("abbey")).to.have.length(1);
      expect(albumsDb.search("beat")).to.have.length(1);
      expect(albumsDb.search("missing")).to.deep.equal([]);
    });
    it("search orders title asc and respects limit", () => {
      for (let i = 0; i < 25; i++) albumsDb.findOrCreate(`SearchAl${i}`);
      expect(albumsDb.search("SearchAl")).to.have.length(20);
    });
    it("getCoverPreviews filters NULL and empty", () => {
      const aid = artistsDb.findOrCreate("CoverArtist");
      const id1 = albumsDb.findOrCreate("WithCover", aid);
      const id2 = albumsDb.findOrCreate("NoCover", aid);
      const id3 = albumsDb.findOrCreate("EmptyCover", aid);
      albumsDb.updateCoverPath(id1, "covers/a.jpg");
      albumsDb.updateCoverPath(id3, "");
      expect(albumsDb.getCoverPreviews(aid, 10)).to.deep.equal([
        "covers/a.jpg",
      ]);
      expect(albumsDb.getCoverPreviews(aid, 1)).to.have.length(1);
      expect(albumsDb.getCoverPreviews(99999, 10)).to.deep.equal([]);
    });
    it("getCoverPreviews respects limit", () => {
      const aid = artistsDb.findOrCreate("LimitArtist");
      for (let i = 0; i < 5; i++) {
        const id = albumsDb.findOrCreate(`Al${i}`, aid);
        albumsDb.updateCoverPath(id, `covers/${i}.jpg`);
      }
      expect(albumsDb.getCoverPreviews(aid, 2)).to.have.length(2);
    });
  });

  describe("getByTitleAndArtist / updateCoverPath / updateLastPlayed / getRecentAlbums / getRankedByPlayCount", () => {
    it("getByTitleAndArtist NOCASE artist", () => {
      const aid = artistsDb.findOrCreate("Beatles");
      albumsDb.findOrCreate("Abbey Road", aid);
      expect(
        albumsDb.getByTitleAndArtist("Abbey Road", "beatles")?.title,
      ).to.equal("Abbey Road");
      expect(albumsDb.getByTitleAndArtist("Abbey Road", "Rolling")).to.be
        .undefined;
      expect(albumsDb.getByTitleAndArtist("Missing", "Beatles")).to.be
        .undefined;
    });
    it("updateCoverPath persists", () => {
      const id = albumsDb.findOrCreate("CoverAl");
      albumsDb.updateCoverPath(id, "covers/x.jpg");
      expect(albumsDb.getById(id)?.cover_path).to.equal("covers/x.jpg");
    });
    it("updateCoverPath no throw on missing id", () => {
      albumsDb.updateCoverPath(99999, "covers/y.jpg");
      expect(albumsDb.count()).to.equal(0);
    });
    it("updateLastPlayed sets datetime", () => {
      const id = albumsDb.findOrCreate("PlayAl");
      albumsDb.updateLastPlayed(id);
      expect(albumsDb.getById(id)?.last_played).to.be.a("string");
    });
    it("getRecentAlbums filters last_played not null and excludes id", () => {
      const id1 = albumsDb.findOrCreate("Recent1");
      const id2 = albumsDb.findOrCreate("Recent2");
      albumsDb.updateLastPlayed(id1);
      albumsDb.updateLastPlayed(id2);
      const all = albumsDb.getRecentAlbums(10);
      expect(all).to.have.length(2);
      const excl = albumsDb.getRecentAlbums(10, id1);
      expect(excl.every((a) => a.id !== id1)).to.be.true;
      expect(excl).to.have.length(1);
    });
    it("getRecentAlbums returns [] when none played", () => {
      albumsDb.findOrCreate("NeverPlayed");
      expect(albumsDb.getRecentAlbums(10)).to.deep.equal([]);
    });
    it("getRankedByPlayCount orders by sum play_count desc", () => {
      const aid = artistsDb.findOrCreate("RankArtist");
      const al1 = albumsDb.findOrCreate("LowAl", aid);
      const al2 = albumsDb.findOrCreate("HighAl", aid);
      // Insert tracks with play counts
      const id1 = tracksDb.upsert({
        file: "a/low.mp3",
        title: "T1",
        artist: "RankArtist",
        album: "LowAl",
        play_count: 1,
      } as never);
      const id2 = tracksDb.upsert({
        file: "a/high.mp3",
        title: "T2",
        artist: "RankArtist",
        album: "HighAl",
        play_count: 99,
      } as never);
      // Need to patch play_count via direct update (upsert ignores it except via rebuild)
      db()
        .update(tracks)
        .set({ play_count: 1 })
        .where(eq(tracks.id, id1))
        .run();
      db()
        .update(tracks)
        .set({ play_count: 99 })
        .where(eq(tracks.id, id2))
        .run();
      // Ensure album linkage is correct — tracksDb upsert already linked via artist/album
      const ranked = albumsDb.getRankedByPlayCount({ artistId: aid });
      expect(ranked[0].title).to.equal("HighAl");
    });
    it("getRankedByPlayCount filters by genre name case-insensitive", () => {
      const gid = genresDb.findOrCreate("Rock");
      const aid = artistsDb.findOrCreate("GArtist");
      albumsDb.findOrCreate("RockAl", aid, undefined, gid);
      albumsDb.findOrCreate("PopAl", aid);
      expect(
        albumsDb.getRankedByPlayCount({ genre: "rock" }).map((a) => a.title),
      ).to.deep.equal(["RockAl"]);
      expect(
        albumsDb.getRankedByPlayCount({ genre: "ROCK" }).map((a) => a.title),
      ).to.deep.equal(["RockAl"]);
    });
    it("getRankedByPlayCount filters by genreId", () => {
      const gid = genresDb.findOrCreate("Jazz");
      const aid = artistsDb.findOrCreate("JArtist");
      albumsDb.findOrCreate("JazzAl", aid, undefined, gid);
      expect(albumsDb.getRankedByPlayCount({ genreId: gid })).to.have.length(1);
    });
    it("getRankedByPlayCount no filter returns all", () => {
      albumsDb.findOrCreate("Any1");
      albumsDb.findOrCreate("Any2");
      expect(albumsDb.getRankedByPlayCount()).to.have.length(2);
    });
  });
});
