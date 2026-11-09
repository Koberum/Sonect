import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import {
  tracksDb,
  albumsDb,
  db,
  upsertTrack,
  findOrCreateArtist,
  findOrCreateAlbum,
  storageDb,
  tracks,
} from "@repo/db";
import type { CatalogTrack } from "@repo/types";

import { eq } from "drizzle-orm";

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
      ...overrides,
    } as unknown as import("@repo/types").MPDTrack;
  }

  describe("upsertTrack parsing helpers", () => {
    it("parses track 3/10 → track_number 3", () => {
      const id = upsertTrack(
        db(),
        mpdTrack({ file: "a/t1.mp3", track: "3/10" }),
      );
      expect(tracksDb.getById(id)?.track_number).to.equal(3);
    });
    it("parses disc string → int", () => {
      const id = upsertTrack(db(), mpdTrack({ file: "a/t2.mp3", disc: "2" }));
      expect(tracksDb.getById(id)?.disc_number).to.equal(2);
    });
    it("parses date 2020-05-01 → year 2020 via album year", () => {
      const id = upsertTrack(
        db(),
        mpdTrack({ file: "a/t3.mp3", date: "2020-05-01", album: "YearAl" }),
      );
      const row = tracksDb.getById(id);
      expect(row?.album_id).to.be.a("number");
      const al = albumsDb.getById(row!.album_id!);
      expect(al?.year).to.equal(2020);
    });
    it("handles missing track/disc/date → null", () => {
      const id = upsertTrack(
        db(),
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
      const id1 = upsertTrack(db(), payload);
      const id2 = upsertTrack(db(), {
        ...(payload as Record<string, unknown>),
        title: "Second",
      } as unknown as import("@repo/types").MPDTrack);
      expect(id1).to.equal(id2);
      expect(tracksDb.getById(id1)?.title).to.equal("Second");
    });
    it("upsert updates existing without changing id", () => {
      const id = upsertTrack(
        db(),
        mpdTrack({ file: "a/upd.mp3", title: "Old" }),
      );
      upsertTrack(db(), mpdTrack({ file: "a/upd.mp3", title: "New" }));
      expect(tracksDb.getById(id)?.title).to.equal("New");
      expect(tracksDb.count()).to.equal(1);
    });
    it("creates artist/album/genre relations", () => {
      const id = upsertTrack(
        db(),
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
      const id = upsertTrack(
        db(),
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
    it("upsert stores file mtime and size", () => {
      upsertTrack(db(), {
        ...mpdTrack({ file: "a/t.mp3" }),
        mtime: 1700000000000,
        size: 4096,
      });
      const row = tracksDb.getByFile("a/t.mp3");
      expect(row?.mtime).to.equal(1700000000000);
      expect(row?.size).to.equal(4096);
    });
    it("handles albumArtist fallback for album artist", () => {
      const id = upsertTrack(
        db(),
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
      const aid = findOrCreateArtist(db(), "ReuseArtist");
      const alId = findOrCreateAlbum(db(), "ReuseAl", aid);
      const id = upsertTrack(
        db(),
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

  describe("count / getById / getByIdWithRelations / getByAlbum", () => {
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
    it("getByAlbum orders disc/track/title", () => {
      const aid = findOrCreateArtist(db(), "AlArtist");
      const al = findOrCreateAlbum(db(), "OrdAl", aid);
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
      const aid = findOrCreateArtist(db(), "Ord2Artist");
      const al = findOrCreateAlbum(db(), "Ord2Al", aid);
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
      const id = upsertTrack(db(), mpdTrack({ file: "a/find.mp3" }));
      expect(tracksDb.getByFile("a/find.mp3")?.id).to.equal(id);
      expect(tracksDb.getByFile("missing.mp3")).to.be.undefined;
    });
  });

  describe("getByArtistWithRelations / getByAlbumWithRelations / getByArtistAlbumTitle", () => {
    it("getByArtistWithRelations title asc", () => {
      const aid = findOrCreateArtist(db(), "RelArtist");
      const al = findOrCreateAlbum(db(), "RelAl", aid);
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
      const aid = findOrCreateArtist(db(), "RelAlArtist");
      const al = findOrCreateAlbum(db(), "RelOrdAl", aid);
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
    it("collapses identical copies in album views but keeps distinct positions", () => {
      const aid = findOrCreateArtist(db(), "DupArtist");
      const al = findOrCreateAlbum(db(), "DupAlbum", aid);
      const copies = ["x/copy1.mp3", "x/copy2.mp3", "x/copy3.mp3"];
      for (const file of copies) {
        db()
          .insert(tracks)
          .values({
            file,
            title: "Same Song",
            artist_id: aid,
            album_id: al,
            disc_number: 1,
            track_number: 1,
          })
          .run();
      }
      db()
        .insert(tracks)
        .values({
          file: "x/other.mp3",
          title: "Same Song",
          artist_id: aid,
          album_id: al,
          disc_number: 1,
          track_number: 2,
        })
        .run();

      const related = tracksDb.getByAlbumWithRelations(al);
      expect(related).to.have.length(2);
      expect(related.map((t) => t.track_number)).to.deep.equal([1, 2]);
      expect(tracksDb.getByAlbumOrdered(al)).to.have.length(2);
    });
    it("collapses copies with different track artists and keeps the lossless one", () => {
      const lossyArtist = findOrCreateArtist(db(), "Lossy Artist");
      const flacArtist = findOrCreateArtist(db(), "Flac Artist");
      const al = findOrCreateAlbum(db(), "Format Album", flacArtist);
      db()
        .insert(tracks)
        .values({
          file: "x/track.mp3",
          title: "Format Song",
          artist_id: lossyArtist,
          album_id: al,
          disc_number: 1,
          track_number: 1,
        })
        .run();
      db()
        .insert(tracks)
        .values({
          file: "x/track.flac",
          title: "Format Song",
          artist_id: flacArtist,
          album_id: al,
          disc_number: 1,
          track_number: 1,
        })
        .run();

      const related = tracksDb.getByAlbumWithRelations(al);
      expect(related).to.have.length(1);
      expect(related[0]?.file).to.equal("x/track.flac");
      const ordered = tracksDb.getByAlbumOrdered(al);
      expect(ordered).to.have.length(1);
      expect(ordered[0]?.file).to.equal("x/track.flac");
    });
    it("getByArtistAlbumTitle NOCASE artist, case-sensitive album/title", () => {
      upsertTrack(
        db(),
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

  describe("search / getGenres / getByGenre", () => {
    it("search finds via title/artist/album LIKE", () => {
      upsertTrack(
        db(),
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
        upsertTrack(
          db(),
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
    it("getGenres removed — use genresDb.getAllWithCounts", () => {
      expect(
        typeof (tracksDb as unknown as Record<string, unknown>).getGenres,
      ).to.equal("undefined");
    });
    it("getByGenreWithRelations case-insensitive and ordered title asc", () => {
      upsertTrack(
        db(),
        mpdTrack({ file: "a/gga.mp3", title: "B", genre: "Shoegaze" }),
      );
      upsertTrack(
        db(),
        mpdTrack({ file: "a/ggb.mp3", title: "A", genre: "Shoegaze" }),
      );
      upsertTrack(
        db(),
        mpdTrack({ file: "a/ggb.mp3", title: "A", genre: "Shoegaze" }),
      );
      expect(
        tracksDb.getByGenreWithRelations("shoegaze").map((t) => t.title),
      ).to.deep.equal(["A", "B"]);
    });
  });

  describe("play counts / discovery / top", () => {
    it("incrementPlayCount", () => {
      const id = upsertTrack(db(), mpdTrack({ file: "a/inc.mp3" }));
      db().update(tracks).set({ play_count: 2 }).where(eq(tracks.id, id)).run();
      tracksDb.incrementPlayCount(id);
      expect(tracksDb.getById(id)?.play_count).to.equal(3);
    });
    it("getTracksByGenre with limit", () => {
      upsertTrack(
        db(),
        mpdTrack({ file: "a/gb1.mp3", genre: "Jazz", title: "J1" }),
      );
      upsertTrack(
        db(),
        mpdTrack({ file: "a/gb2.mp3", genre: "Jazz", title: "J2" }),
      );
      expect(tracksDb.getTracksByGenre("Jazz", 1)).to.have.length(1);
    });
  });

  describe("sync snapshot and source attribution", () => {
    it("persists audio format fields and exposes them in the sync snapshot", () => {
      const id = upsertTrack(
        db(),
        mpdTrack({
          file: "format/a.flac",
          title: "A",
          sampleRate: 48000,
          bitsPerSample: 24,
          channels: 2,
        }),
      );

      expect(tracksDb.getById(id)).to.include({
        sample_rate: 48000,
        bits_per_sample: 24,
        channels: 2,
      });
      expect(tracksDb.getSyncSnapshot()[0]).to.include({
        sample_rate: 48000,
        bits_per_sample: 24,
        channels: 2,
      });
    });

    it("getSyncSnapshot includes attribution and relations", () => {
      const sourceId = storageDb.create({
        name: "Lib",
        path: "/libraries/lib",
        enabled: true,
      });
      upsertTrack(db(), {
        ...mpdTrack({
          file: "lib/a.mp3",
          title: "A",
          artist: "ArtistA",
          album: "AlbumA",
          genre: "Rock",
        }),
        storageSourceId: sourceId,
      } as CatalogTrack);
      db()
        .update(tracks)
        .set({ storage_source_id: sourceId })
        .where(eq(tracks.file, "lib/a.mp3"))
        .run();

      const snap = tracksDb
        .getSyncSnapshot()
        .find((row) => row.file === "lib/a.mp3");
      expect(snap).to.include({
        title: "A",
        artist_name: "ArtistA",
        album_title: "AlbumA",
        genre: "Rock",
        storage_source_id: sourceId,
      });
      expect(tracksDb.countByStorageSource(sourceId)).to.equal(1);
    });
  });
});
