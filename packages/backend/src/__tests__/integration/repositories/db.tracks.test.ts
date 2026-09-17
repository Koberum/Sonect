import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { tracksDb, artistsDb, albumsDb, genresDb } from "@repo/db";
import { db } from "@repo/db";
import { tracks, albums } from "@repo/db";
import { eq, sql } from "drizzle-orm";

describe("tracksDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  function mpdTrack(overrides: Record<string, unknown> = {}) {
    return {
      file: `a/${Math.random().toString(36).slice(2)}.mp3`,
      title: "T",
      artist: "ArtistA",
      album: "AlbumA",
      genre: "Rock",
      duration: 200,
      track: "3/10",
      disc: "1",
      date: "2020-05-01",
      lastModified: "2020-05-01T00:00:00Z",
      ...overrides,
    } as unknown as import("@repo/types").MPDTrack;
  }

  describe("upsertTrack parsing helpers", () => {
    it("parses track 3/10 → track_number 3", () => {
      const id = tracksDb.upsert(mpdTrack({ file: "a/t1.mp3", track: "3/10" }));
      expect(tracksDb.getById(id)?.track_number).to.equal(3);
    });
    it("parses disc string → int", () => {
      const id = tracksDb.upsert(mpdTrack({ file: "a/t2.mp3", disc: "2" }));
      expect(tracksDb.getById(id)?.disc_number).to.equal(2);
    });
    it("parses date 2020-05-01 → year 2020 via album year", () => {
      const id = tracksDb.upsert(
        mpdTrack({ file: "a/t3.mp3", date: "2020-05-01", album: "YearAl" }),
      );
      const row = tracksDb.getById(id);
      expect(row?.album_id).to.be.a("number");
      const al = albumsDb.getById(row!.album_id!);
      expect(al?.year).to.equal(2020);
    });
    it("handles missing track/disc/date → null", () => {
      const id = tracksDb.upsert(
        mpdTrack({
          file: "a/t4.mp3",
          track: undefined,
          disc: undefined,
          date: undefined,
        }),
      );
      const row = tracksDb.getById(id);
      expect(row?.track_number).to.be.null;
      expect(row?.disc_number).to.be.null;
    });
    it("upsert is idempotent on file — second upsert updates title", () => {
      const payload = mpdTrack({ file: "a/same.mp3", title: "First" });
      const id1 = tracksDb.upsert(payload);
      const id2 = tracksDb.upsert({
        ...(payload as Record<string, unknown>),
        title: "Second",
      } as unknown as import("@repo/types").MPDTrack);
      expect(id1).to.equal(id2);
      expect(tracksDb.getById(id1)?.title).to.equal("Second");
    });
    it("upsert updates existing without changing id", () => {
      const id = tracksDb.upsert(mpdTrack({ file: "a/upd.mp3", title: "Old" }));
      tracksDb.upsert(mpdTrack({ file: "a/upd.mp3", title: "New" }));
      expect(tracksDb.getById(id)?.title).to.equal("New");
      expect(tracksDb.count()).to.equal(1);
    });
    it("creates artist/album/genre relations", () => {
      const id = tracksDb.upsert(
        mpdTrack({
          file: "a/rel.mp3",
          artist: "NewArtist",
          album: "NewAlbum",
          genre: "Jazz",
        }),
      );
      const row = tracksDb.getByIdWithRelations(id);
      expect(row?.artist_name).to.equal("NewArtist");
      expect(row?.album_title).to.equal("NewAlbum");
      expect(row?.genre).to.equal("Jazz");
    });
    it("handles missing artist/album → null ids and empty genre trimmed", () => {
      const id = tracksDb.upsert(
        mpdTrack({
          file: "a/orphan.mp3",
          artist: undefined,
          album: undefined,
          genre: "   ",
        }),
      );
      const row = tracksDb.getById(id);
      expect(row?.artist_id).to.be.null;
      expect(row?.album_id).to.be.null;
      expect(row?.genre_id).to.be.null;
    });
    it("handles albumArtist fallback for album artist", () => {
      const id = tracksDb.upsert(
        mpdTrack({
          file: "a/aa.mp3",
          artist: "TrackArtist",
          albumArtist: "AlbumArtistX",
          album: "AAAl",
        }),
      );
      const al = albumsDb.getByTitleAndArtist("AAAl", "AlbumArtistX");
      expect(al).to.exist;
      expect(tracksDb.getById(id)?.album_id).to.equal(al!.id);
    });
    it("reuses existing album and updates title", () => {
      const aid = artistsDb.findOrCreate("ReuseArtist");
      const alId = albumsDb.findOrCreate("ReuseAl", aid);
      const id = tracksDb.upsert(
        mpdTrack({
          file: "a/reuse.mp3",
          artist: "ReuseArtist",
          album: "ReuseAl",
          title: "ReuseTrack",
        }),
      );
      expect(tracksDb.getById(id)?.album_id).to.equal(alId);
    });
  });

  describe("count / getById / getByIdWithRelations / getByArtist / getByAlbum", () => {
    it("count 0 when empty", () => expect(tracksDb.count()).to.equal(0));
    it("getById miss → undefined", () =>
      expect(tracksDb.getById(99999)).to.be.undefined);
    it("getByIdWithRelations miss → undefined", () =>
      expect(tracksDb.getByIdWithRelations(99999)).to.be.undefined);
    it("getByIdWithRelations innerJoin excludes orphan", () => {
      const orphanId = db()
        .insert(tracks)
        .values({
          file: "orphan.mp3",
          title: "Orphan",
          artist_id: null,
          album_id: null,
        })
        .run().lastInsertRowid as number;
      expect(tracksDb.getByIdWithRelations(orphanId)).to.be.undefined;
      expect(tracksDb.getById(orphanId)?.title).to.equal("Orphan");
    });
    it("getByArtist returns title asc", () => {
      const aid = artistsDb.findOrCreate("SortArtist");
      const al = albumsDb.findOrCreate("SortAl", aid);
      db()
        .insert(tracks)
        .values({
          file: "a/z.mp3",
          title: "Zebra",
          artist_id: aid,
          album_id: al,
        })
        .run();
      db()
        .insert(tracks)
        .values({
          file: "a/a.mp3",
          title: "Alpha",
          artist_id: aid,
          album_id: al,
        })
        .run();
      expect(tracksDb.getByArtist(aid).map((t) => t.title)).to.deep.equal([
        "Alpha",
        "Zebra",
      ]);
      expect(tracksDb.getByArtist(99999)).to.deep.equal([]);
    });
    it("getByAlbum orders disc/track/title", () => {
      const aid = artistsDb.findOrCreate("AlArtist");
      const al = albumsDb.findOrCreate("OrdAl", aid);
      db()
        .insert(tracks)
        .values({
          file: "a/2.mp3",
          title: "B",
          artist_id: aid,
          album_id: al,
          disc_number: 1,
          track_number: 2,
        })
        .run();
      db()
        .insert(tracks)
        .values({
          file: "a/1.mp3",
          title: "A",
          artist_id: aid,
          album_id: al,
          disc_number: 1,
          track_number: 1,
        })
        .run();
      db()
        .insert(tracks)
        .values({
          file: "a/3.mp3",
          title: "C",
          artist_id: aid,
          album_id: al,
          disc_number: 2,
          track_number: 1,
        })
        .run();
      expect(tracksDb.getByAlbum(al).map((t) => t.title)).to.deep.equal([
        "A",
        "B",
        "C",
      ]);
    });
    it("getByAlbumOrdered orders disc/track only", () => {
      const aid = artistsDb.findOrCreate("Ord2Artist");
      const al = albumsDb.findOrCreate("Ord2Al", aid);
      db()
        .insert(tracks)
        .values({
          file: "a/b.mp3",
          title: "B",
          artist_id: aid,
          album_id: al,
          disc_number: 1,
          track_number: 2,
        })
        .run();
      db()
        .insert(tracks)
        .values({
          file: "a/a.mp3",
          title: "A",
          artist_id: aid,
          album_id: al,
          disc_number: 1,
          track_number: 1,
        })
        .run();
      expect(tracksDb.getByAlbumOrdered(al).map((t) => t.title)).to.deep.equal([
        "A",
        "B",
      ]);
    });
    it("getByFile found and miss", () => {
      const id = tracksDb.upsert(mpdTrack({ file: "a/find.mp3" }));
      expect(tracksDb.getByFile("a/find.mp3")?.id).to.equal(id);
      expect(tracksDb.getByFile("missing.mp3")).to.be.undefined;
    });
    it("deleteByFile removes", () => {
      tracksDb.upsert(mpdTrack({ file: "a/del.mp3" }));
      tracksDb.deleteByFile("a/del.mp3");
      expect(tracksDb.getByFile("a/del.mp3")).to.be.undefined;
    });
  });

  describe("getByArtistWithRelations / getByAlbumWithRelations / getByArtistAlbumTitle", () => {
    it("getByArtistWithRelations title asc", () => {
      const aid = artistsDb.findOrCreate("RelArtist");
      const al = albumsDb.findOrCreate("RelAl", aid);
      db()
        .insert(tracks)
        .values({
          file: "a/z2.mp3",
          title: "Zebra",
          artist_id: aid,
          album_id: al,
        })
        .run();
      db()
        .insert(tracks)
        .values({
          file: "a/a2.mp3",
          title: "Alpha",
          artist_id: aid,
          album_id: al,
        })
        .run();
      expect(
        tracksDb.getByArtistWithRelations(aid).map((t) => t.title),
      ).to.deep.equal(["Alpha", "Zebra"]);
    });
    it("getByAlbumWithRelations orders disc/track/title", () => {
      const aid = artistsDb.findOrCreate("RelAlArtist");
      const al = albumsDb.findOrCreate("RelOrdAl", aid);
      db()
        .insert(tracks)
        .values({
          file: "a/b2.mp3",
          title: "B",
          artist_id: aid,
          album_id: al,
          disc_number: 1,
          track_number: 2,
        })
        .run();
      db()
        .insert(tracks)
        .values({
          file: "a/a3.mp3",
          title: "A",
          artist_id: aid,
          album_id: al,
          disc_number: 1,
          track_number: 1,
        })
        .run();
      expect(
        tracksDb.getByAlbumWithRelations(al).map((t) => t.title),
      ).to.deep.equal(["A", "B"]);
    });
    it("getByArtistAlbumTitle NOCASE artist, case-sensitive album/title", () => {
      tracksDb.upsert(
        mpdTrack({
          file: "a/coll.mp3",
          artist: "The Beatles",
          album: "Abbey Road",
          title: "Come Together",
        }),
      );
      expect(
        tracksDb.getByArtistAlbumTitle(
          "the beatles",
          "Abbey Road",
          "Come Together",
        )?.title,
      ).to.equal("Come Together");
      expect(
        tracksDb.getByArtistAlbumTitle(
          "The Beatles",
          "abbey road",
          "Come Together",
        ),
      ).to.be.undefined;
      expect(
        tracksDb.getByArtistAlbumTitle(
          "The Beatles",
          "Abbey Road",
          "come together",
        ),
      ).to.be.undefined;
      expect(tracksDb.getByArtistAlbumTitle("Nobody", "Nowhere", "Nothing")).to
        .be.undefined;
    });
  });

  describe("search / getAllWithRelations / getRecentWithRelations / getGenres / getByGenre", () => {
    it("search finds via title/artist/album LIKE", () => {
      tracksDb.upsert(
        mpdTrack({
          file: "a/s1.mp3",
          title: "UniqueTitle999",
          artist: "SearchArtist",
          album: "SearchAlbum",
        }),
      );
      expect(tracksDb.search("UniqueTitle999")).to.have.length(1);
      expect(tracksDb.search("SearchArtist")).to.have.length(1);
      expect(tracksDb.search("SearchAlbum")).to.have.length(1);
      expect(tracksDb.search("missingXYZ")).to.deep.equal([]);
    });
    it("search orders title asc and respects limit", () => {
      for (let i = 0; i < 5; i++)
        tracksDb.upsert(
          mpdTrack({
            file: `a/srch${i}.mp3`,
            title: `Srch${String(i).padStart(2, "0")}`,
          }),
        );
      const res = tracksDb.search("Srch");
      expect(res.map((t) => t.title)).to.deep.equal(
        [...res].map((t) => t.title).sort(),
      );
    });
    it("getAllWithRelations sorts: recent/duration/title and pagination guard", () => {
      const aid = artistsDb.findOrCreate("SortTArtist");
      const al = albumsDb.findOrCreate("SortTAl", aid);
      const id1 = db()
        .insert(tracks)
        .values({
          file: "a/short.mp3",
          title: "Short",
          artist_id: aid,
          album_id: al,
          duration: 10,
        })
        .run().lastInsertRowid as number;
      const id2 = db()
        .insert(tracks)
        .values({
          file: "a/long.mp3",
          title: "Long",
          artist_id: aid,
          album_id: al,
          duration: 300,
        })
        .run().lastInsertRowid as number;
      expect(tracksDb.getAllWithRelations("duration")[0].title).to.equal(
        "Long",
      );
      expect(tracksDb.getAllWithRelations().map((t) => t.title)).to.deep.equal(
        ["Long", "Short"].sort(),
      );
      // pagination guard
      expect(
        tracksDb.getAllWithRelations(undefined, undefined, 5 as never),
      ).to.have.length(2);
      expect(tracksDb.getAllWithRelations(undefined, 1, 1)).to.have.length(1);
      // recent sort
      db()
        .update(tracks)
        .set({ created_at: "2020-01-02 00:00:00" })
        .where(eq(tracks.id, id2))
        .run();
      db()
        .update(tracks)
        .set({ created_at: "2020-01-01 00:00:00" })
        .where(eq(tracks.id, id1))
        .run();
      expect(tracksDb.getAllWithRelations("recent")[0].title).to.equal("Long");
      // orphan inclusion via leftJoin
      const orphanId = db()
        .insert(tracks)
        .values({
          file: "orphan.mp3",
          title: "Orphan",
          artist_id: null,
          album_id: null,
        })
        .run().lastInsertRowid as number;
      expect(tracksDb.getAllWithRelations().some((t) => t.id === orphanId)).to
        .be.true;
    });
    it("getRecentWithRelations limit", () => {
      for (let i = 0; i < 5; i++)
        tracksDb.upsert(mpdTrack({ file: `a/recent${i}.mp3` }));
      expect(tracksDb.getRecentWithRelations(2)).to.have.length(2);
      expect(tracksDb.getRecentWithRelations(10)).to.have.length(5);
    });
    it("getGenres removed — use genresDb.getAllWithCounts", () => {
      expect(
        typeof (tracksDb as unknown as Record<string, unknown>).getGenres,
      ).to.equal("undefined");
    });
    it("getByGenre case-insensitive", () => {
      tracksDb.upsert(mpdTrack({ file: "a/gg1.mp3", genre: "Shoegaze" }));
      expect(tracksDb.getByGenre("shoegaze")).to.have.length(1);
      expect(tracksDb.getByGenre("SHOEGAZE")).to.have.length(1);
      expect(tracksDb.getByGenre("missing")).to.deep.equal([]);
    });
    it("getByGenreWithRelations case-insensitive and ordered title asc", () => {
      tracksDb.upsert(
        mpdTrack({ file: "a/gga.mp3", title: "B", genre: "Shoegaze" }),
      );
      tracksDb.upsert(
        mpdTrack({ file: "a/ggb.mp3", title: "A", genre: "Shoegaze" }),
      );
      expect(
        tracksDb.getByGenreWithRelations("shoegaze").map((t) => t.title),
      ).to.deep.equal(["A", "B"]);
    });
  });

  describe("play counts / discovery / top", () => {
    it("incrementPlayCount", () => {
      const id = tracksDb.upsert(mpdTrack({ file: "a/inc.mp3" }));
      db().update(tracks).set({ play_count: 2 }).where(eq(tracks.id, id)).run();
      tracksDb.incrementPlayCount(id);
      expect(tracksDb.getById(id)?.play_count).to.equal(3);
    });
    it("getTopTracks orders play_count desc", () => {
      const idLow = tracksDb.upsert(
        mpdTrack({ file: "a/low.mp3", title: "Low" }),
      );
      const idHigh = tracksDb.upsert(
        mpdTrack({ file: "a/high.mp3", title: "High" }),
      );
      db()
        .update(tracks)
        .set({ play_count: 1 })
        .where(eq(tracks.id, idLow))
        .run();
      db()
        .update(tracks)
        .set({ play_count: 99 })
        .where(eq(tracks.id, idHigh))
        .run();
      expect(tracksDb.getTopTracks(1)[0].title).to.equal("High");
    });
    it("getRecentlyPlayed filters last_played not null", () => {
      const id = tracksDb.upsert(mpdTrack({ file: "a/rp.mp3" }));
      expect(tracksDb.getRecentlyPlayed(10)).to.deep.equal([]);
      db()
        .update(tracks)
        .set({ last_played: "2020-01-01 00:00:00" })
        .where(eq(tracks.id, id))
        .run();
      expect(tracksDb.getRecentlyPlayed(10)).to.have.length(1);
    });
    it("getTracksForDiscovery empty lists → []", () => {
      tracksDb.upsert(mpdTrack({ file: "a/d1.mp3" }));
      expect(tracksDb.getTracksForDiscovery([], [], 10)).to.deep.equal([]);
    });
    it("getTracksForDiscovery filters play_count <3 or null", () => {
      const aid = artistsDb.findOrCreate("DiscArtist");
      const al = albumsDb.findOrCreate("DiscAl", aid);
      const idHigh = db()
        .insert(tracks)
        .values({
          file: "a/highDisc.mp3",
          title: "HighDisc",
          artist_id: aid,
          album_id: al,
          play_count: 10,
        })
        .run().lastInsertRowid as number;
      const idLow = db()
        .insert(tracks)
        .values({
          file: "a/lowDisc.mp3",
          title: "LowDisc",
          artist_id: aid,
          album_id: al,
          play_count: 1,
        })
        .run().lastInsertRowid as number;
      // Need genre linkage for discovery — use genre
      const gid = genresDb.findOrCreate("Rock");
      db()
        .update(tracks)
        .set({ genre_id: gid })
        .where(eq(tracks.id, idLow))
        .run();
      db()
        .update(tracks)
        .set({ genre_id: gid })
        .where(eq(tracks.id, idHigh))
        .run();
      const res = tracksDb.getTracksForDiscovery(["Rock"], [], 10);
      expect(res.some((t) => t.id === idLow)).to.be.true;
      expect(res.some((t) => t.id === idHigh)).to.be.false;
    });
    it("getTopGenres / getTopGenre / getTopArtists", () => {
      const gidRock = genresDb.findOrCreate("Rock");
      const gidPop = genresDb.findOrCreate("Pop");
      const aid = artistsDb.findOrCreate("TopArtist");
      const al1 = albumsDb.findOrCreate("TopAl1", aid);
      const al2 = albumsDb.findOrCreate("TopAl2", aid);
      const id1 = db()
        .insert(tracks)
        .values({
          file: "a/tg1.mp3",
          title: "TG1",
          artist_id: aid,
          album_id: al1,
          genre_id: gidRock,
          play_count: 10,
        })
        .run().lastInsertRowid as number;
      const id2 = db()
        .insert(tracks)
        .values({
          file: "a/tg2.mp3",
          title: "TG2",
          artist_id: aid,
          album_id: al2,
          genre_id: gidPop,
          play_count: 1,
        })
        .run().lastInsertRowid as number;
      void id1;
      void id2;
      expect(tracksDb.getTopGenres(1)[0]).to.equal("Rock");
      expect(tracksDb.getTopGenre()).to.equal("Rock");
      const topArtists = tracksDb.getTopArtists(1);
      expect(topArtists[0].name).to.equal("TopArtist");
      expect(topArtists[0].total).to.equal(11);
    });
    it("getTopGenre returns null when no data", () => {
      expect(tracksDb.getTopGenre()).to.be.null;
    });
    it("getTracksByGenre with limit", () => {
      tracksDb.upsert(
        mpdTrack({ file: "a/gb1.mp3", genre: "Jazz", title: "J1" }),
      );
      tracksDb.upsert(
        mpdTrack({ file: "a/gb2.mp3", genre: "Jazz", title: "J2" }),
      );
      expect(tracksDb.getTracksByGenre("Jazz", 1)).to.have.length(1);
    });
    it("getRandomTracks with excludeFiles", () => {
      tracksDb.upsert(mpdTrack({ file: "a/r1.mp3" }));
      tracksDb.upsert(mpdTrack({ file: "a/r2.mp3" }));
      const all = tracksDb.getRandomTracks(10);
      expect(all).to.have.length(2);
      const excl = tracksDb.getRandomTracks(10, ["a/r1.mp3"]);
      expect(excl.every((t) => t.file !== "a/r1.mp3")).to.be.true;
    });
    it("getRandomTracks without exclude", () => {
      tracksDb.upsert(mpdTrack({ file: "a/rand.mp3" }));
      expect(tracksDb.getRandomTracks(1)).to.have.length(1);
    });
  });
});
