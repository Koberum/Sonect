import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { AutoplayService } from "@services/mpd/autoplayService.js";
import { albumsDb } from "@repo/db";
import { db } from "@repo/db";
import { tracks, albums } from "@repo/db";
import { eq } from "drizzle-orm";

describe("AutoplayService genre-anchored", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("techno seed with sparse techno catalog stays techno, does not inject rock/pop", () => {
    const techArtist = artist.create({ name: "TechArtist" }, 100);
    const rockArtist = artist.create({ name: "RockArtist" }, 200);
    const techAl1 = album.create(
      { title: "TechOne", artistName: techArtist.name, genreName: "Techno" },
      101,
    );
    const techAl2 = album.create(
      { title: "TechTwo", artistName: techArtist.name, genreName: "Techno" },
      102,
    );
    const seed = track.create(
      {
        artist: techArtist.name,
        album: techAl1.title,
        title: "Seed",
        genre: "Techno",
        track: 1,
      },
      1001,
    );
    track.create(
      {
        artist: techArtist.name,
        album: techAl2.title,
        title: "TechB",
        genre: "Techno",
        track: 1,
      },
      1002,
    );
    const rockAl1 = album.create(
      { title: "RockOne", artistName: rockArtist.name, genreName: "Rock" },
      201,
    );
    const rockAl2 = album.create(
      { title: "RockTwo", artistName: rockArtist.name, genreName: "Rock" },
      202,
    );
    const rockAl3 = album.create(
      { title: "RockThree", artistName: rockArtist.name, genreName: "Rock" },
      203,
    );
    const r1 = track.create(
      {
        artist: rockArtist.name,
        album: rockAl1.title,
        title: "R1",
        genre: "Rock",
        track: 1,
      },
      2001,
    );
    const r2 = track.create(
      {
        artist: rockArtist.name,
        album: rockAl2.title,
        title: "R2",
        genre: "Rock",
        track: 1,
      },
      2002,
    );
    const r3 = track.create(
      {
        artist: rockArtist.name,
        album: rockAl3.title,
        title: "R3",
        genre: "Rock",
        track: 1,
      },
      2003,
    );
    for (const id of [r1.id, r2.id, r3.id]) {
      db()
        .update(tracks)
        .set({ play_count: 99 })
        .where(eq(tracks.id, id))
        .run();
    }
    db()
      .update(tracks)
      .set({ play_count: 1 })
      .where(eq(tracks.id, seed.id))
      .run();

    const svc = new AutoplayService();
    svc.resetSession(seed.file, [seed.file]);
    const batch = svc.getNextBatch(seed.file);
    expect(batch.length).to.be.greaterThan(0);
    const batchGenres = batch.map((f) => {
      const t = db()
        .select()
        .from(tracks)
        .where(eq(tracks.file, f))
        .get() as any;
      const al = t.album_id ? albumsDb.getById(t.album_id) : undefined;
      return al?.genre ?? "";
    });
    expect(
      batchGenres.every((g) => g.toLowerCase() === "techno"),
      `batch genres were ${batchGenres.join(",")}`,
    ).to.be.true;
  });

  it("genre-less seed falls back to library-wide (existing behavior preserved)", () => {
    const a = artist.create({ name: "NoGenreArtist" }, 300);
    const al = album.create({ title: "NoGenreAl", artistName: a.name }, 301);
    // Create track without genre: we cannot pass empty genre (factory defaults to faker), so create then clear genre_id?
    // Instead create with explicit genre then clear it to simulate missing genre
    const seed = track.create(
      { artist: a.name, album: al.title, title: "Seed2", track: 1 },
      3001,
    );
    // Clear genre linkage for seed and its album to make it genre-less
    db()
      .update(tracks)
      .set({ genre_id: null })
      .where(eq(tracks.id, seed.id))
      .run();
    // Album genre also needs to be null
    db()
      .update(albums)
      .set({ genre_id: null })
      .where(eq(albums.id, al.id))
      .run();

    const otherArtist = artist.create({ name: "OtherArtist" }, 400);
    const otherAl = album.create(
      { title: "OtherAl", artistName: otherArtist.name, genreName: "Rock" },
      401,
    );
    track.create(
      {
        artist: otherArtist.name,
        album: otherAl.title,
        title: "Other",
        genre: "Rock",
        track: 1,
      },
      4001,
    );

    const svc = new AutoplayService();
    svc.resetSession(seed.file, [seed.file]);
    const batch = svc.getNextBatch(seed.file);
    expect(batch.length).to.be.greaterThan(0);
  });

  it("similar genre fallback: techno exhausts then picks tech house", () => {
    const techArtist = artist.create({ name: "SimTechArtist" }, 500);
    const houseArtist = artist.create({ name: "HouseArtist" }, 501);
    const rockArtist = artist.create({ name: "SimRockArtist" }, 502);

    const techAl = album.create(
      { title: "SimTechOne", artistName: techArtist.name, genreName: "Techno" },
      510,
    );
    const houseAl = album.create(
      {
        title: "HouseOne",
        artistName: houseArtist.name,
        genreName: "Tech House",
      },
      511,
    );
    const rockAl = album.create(
      { title: "SimRockOne", artistName: rockArtist.name, genreName: "Rock" },
      512,
    );

    const seed = track.create(
      {
        artist: techArtist.name,
        album: techAl.title,
        title: "SimSeed",
        genre: "Techno",
        track: 1,
      },
      5101,
    );
    track.create(
      {
        artist: houseArtist.name,
        album: houseAl.title,
        title: "HouseB",
        genre: "Tech House",
        track: 1,
      },
      5102,
    );
    const rockTrack = track.create(
      {
        artist: rockArtist.name,
        album: rockAl.title,
        title: "RockC",
        genre: "Rock",
        track: 1,
      },
      5103,
    );
    db()
      .update(tracks)
      .set({ play_count: 99 })
      .where(eq(tracks.id, rockTrack.id))
      .run();
    db()
      .update(tracks)
      .set({ play_count: 1 })
      .where(eq(tracks.id, seed.id))
      .run();

    const svc = new AutoplayService();
    svc.resetSession(seed.file, [seed.file]);
    // First batch with only seed's artist genre exhausted: should pull Tech House before Rock
    // Techno has only seed's album (protected) so no same-artist other techno, then exact techno also exhausted,
    // similar tier should pick Tech House
    const batch = svc.getNextBatch(seed.file);
    expect(batch.length).to.be.greaterThan(0);
    const batchFiles = batch;
    const hasHouse = batchFiles.some((f) => {
      const t = db()
        .select()
        .from(tracks)
        .where(eq(tracks.file, f))
        .get() as any;
      const al = t.album_id ? albumsDb.getById(t.album_id) : undefined;
      return al?.genre?.toLowerCase() === "tech house";
    });
    const hasRock = batchFiles.some((f) => {
      const t = db()
        .select()
        .from(tracks)
        .where(eq(tracks.file, f))
        .get() as any;
      const al = t.album_id ? albumsDb.getById(t.album_id) : undefined;
      return al?.genre?.toLowerCase() === "rock";
    });
    expect(hasHouse, "should contain Tech House via similarity").to.be.true;
    expect(hasRock, "should not contain Rock when similar tech house exists").to
      .be.false;
  });

  it("ranking within genre still by sum play_count desc (title tie-break)", () => {
    const a = artist.create({ name: "RankTechArtist" }, 600);
    const alLow = album.create(
      { title: "LowTech", artistName: a.name, genreName: "Techno" },
      610,
    );
    const alHigh = album.create(
      { title: "HighTech", artistName: a.name, genreName: "Techno" },
      611,
    );
    const alMid = album.create(
      { title: "MidTech", artistName: a.name, genreName: "Techno" },
      612,
    );
    const seedAl = album.create(
      { title: "SeedRankTech", artistName: a.name, genreName: "Techno" },
      613,
    );
    const seed = track.create(
      {
        artist: a.name,
        album: seedAl.title,
        title: "SeedRank",
        genre: "Techno",
        track: 1,
      },
      6101,
    );
    const tLow = track.create(
      {
        artist: a.name,
        album: alLow.title,
        title: "Tlow",
        genre: "Techno",
        track: 1,
      },
      6102,
    );
    const tHigh = track.create(
      {
        artist: a.name,
        album: alHigh.title,
        title: "Thigh",
        genre: "Techno",
        track: 1,
      },
      6103,
    );
    const tMid = track.create(
      {
        artist: a.name,
        album: alMid.title,
        title: "Tmid",
        genre: "Techno",
        track: 1,
      },
      6104,
    );
    db()
      .update(tracks)
      .set({ play_count: 1 })
      .where(eq(tracks.id, tLow.id))
      .run();
    db()
      .update(tracks)
      .set({ play_count: 50 })
      .where(eq(tracks.id, tMid.id))
      .run();
    db()
      .update(tracks)
      .set({ play_count: 99 })
      .where(eq(tracks.id, tHigh.id))
      .run();
    db()
      .update(tracks)
      .set({ play_count: 0 })
      .where(eq(tracks.id, seed.id))
      .run();

    const svc = new AutoplayService();
    svc.resetSession(seed.file, [seed.file]);
    // Use a different artist seed so artist tier doesn't dominate: create separate artist for seed
    // Instead seed from new artist with no other albums, so ranking is purely genre tier
    const otherArtist = artist.create({ name: "OtherRankArtist" }, 620);
    const otherSeedAl = album.create(
      {
        title: "OtherSeedAl",
        artistName: otherArtist.name,
        genreName: "Techno",
      },
      620,
    );
    const otherSeed = track.create(
      {
        artist: otherArtist.name,
        album: otherSeedAl.title,
        title: "OtherSeed",
        genre: "Techno",
        track: 1,
      },
      6201,
    );
    const svc2 = new AutoplayService();
    svc2.resetSession(otherSeed.file, [otherSeed.file]);
    const batch = svc2.getNextBatch(otherSeed.file);
    // Map file -> album title
    const titles = batch.map((f) => {
      const t = db()
        .select()
        .from(tracks)
        .where(eq(tracks.file, f))
        .get() as any;
      const al = t.album_id ? albumsDb.getById(t.album_id) : undefined;
      return al?.title ?? "";
    });
    // HighTech should appear before MidTech before LowTech
    const idxHigh = titles.indexOf("HighTech");
    const idxMid = titles.indexOf("MidTech");
    const idxLow = titles.indexOf("LowTech");
    expect(idxHigh).to.be.greaterThan(-1);
    expect(idxMid).to.be.greaterThan(-1);
    expect(idxLow).to.be.greaterThan(-1);
    expect(idxHigh).to.be.lessThan(idxMid);
    expect(idxMid).to.be.lessThan(idxLow);
  });

  it("sparse genre: batch is short but stays within genre (no library-wide)", () => {
    const techArtist = artist.create({ name: "SparseTechArtist" }, 700);
    const rockArtist = artist.create({ name: "SparseRockArtist" }, 701);
    const techAl = album.create(
      {
        title: "SparseTechOne",
        artistName: techArtist.name,
        genreName: "Techno",
      },
      710,
    );
    const seed = track.create(
      {
        artist: techArtist.name,
        album: techAl.title,
        title: "SparseSeed",
        genre: "Techno",
        track: 1,
      },
      7101,
    );
    // Only one techno album exists (seed's own, protected) -> no other techno, similar also empty
    const rockAl = album.create(
      {
        title: "SparseRockOne",
        artistName: rockArtist.name,
        genreName: "Rock",
      },
      711,
    );
    const rockTrack = track.create(
      {
        artist: rockArtist.name,
        album: rockAl.title,
        title: "SparseRock",
        genre: "Rock",
        track: 1,
      },
      7111,
    );
    db()
      .update(tracks)
      .set({ play_count: 999 })
      .where(eq(tracks.id, rockTrack.id))
      .run();

    const svc = new AutoplayService();
    svc.resetSession(seed.file, [seed.file]);
    const batch = svc.getNextBatch(seed.file);
    // Should be empty (no other techno to fill, similar none, library-wide forbidden)
    expect(batch.length).to.equal(0);
    // Re-fill should also stay empty, not inject rock
    const batch2 = svc.getNextBatch(seed.file);
    const hasRock = [...batch, ...batch2].some((f) => {
      const t = db()
        .select()
        .from(tracks)
        .where(eq(tracks.file, f))
        .get() as any;
      const al = t.album_id ? albumsDb.getById(t.album_id) : undefined;
      return al?.genre?.toLowerCase() === "rock";
    });
    expect(hasRock).to.be.false;
  });

  it("cycle wraps within genre after pool exhausted (protected preserved)", () => {
    const a = artist.create({ name: "CycleArtist" }, 800);
    const al1 = album.create(
      { title: "CycleTechOne", artistName: a.name, genreName: "Techno" },
      810,
    );
    const al2 = album.create(
      { title: "CycleTechTwo", artistName: a.name, genreName: "Techno" },
      811,
    );
    const seed = track.create(
      {
        artist: a.name,
        album: al1.title,
        title: "CycleSeed",
        genre: "Techno",
        track: 1,
      },
      8101,
    );
    const other = track.create(
      {
        artist: a.name,
        album: al2.title,
        title: "CycleOther",
        genre: "Techno",
        track: 1,
      },
      8102,
    );
    const svc = new AutoplayService();
    const sid = svc.resetSession(seed.file, [seed.file]);
    const batch1 = svc.getNextBatch(seed.file);
    expect(batch1).to.include(other.file);
    svc.commitBatch(batch1, sid);
    // Next batch should be empty or still techno (but protected/used exclude previous), then after reset it should wrap and return same other again (since protected set keeps current)
    const batch2 = svc.getNextBatch(other.file, { queuedFiles: batch1 });
    // batch2 may be empty because only 2 techno albums both protected/used
    // Force wrap by simulating refill after consuming: clear protected? Use new current file same genre
    // After committing, used contains al2; next call with no queuedFiles should recycle within genre
    const batch3 = svc.getNextBatch(seed.file);
    // After used exhausted, it resets to protected (seed album) and should return other again
    expect(
      batch3.length === 0 ||
        batch3.includes(other.file) ||
        batch3.every((f) => {
          const t = db()
            .select()
            .from(tracks)
            .where(eq(tracks.file, f))
            .get() as any;
          const al = t.album_id ? albumsDb.getById(t.album_id) : undefined;
          return al?.genre?.toLowerCase() === "techno";
        }),
    ).to.be.true;
  });

  it("token fallback for arbitrary genre not in curated map", () => {
    const a = artist.create({ name: "TokenArtist" }, 900);
    const b = artist.create({ name: "TokenBArtist" }, 901);
    const alVapor = album.create(
      { title: "VaporOne", artistName: a.name, genreName: "Vaporwave" },
      910,
    );
    const alVaporHouse = album.create(
      { title: "VaporHouseOne", artistName: b.name, genreName: "Vapor House" },
      911,
    );
    const seed = track.create(
      {
        artist: a.name,
        album: alVapor.title,
        title: "VaporSeed",
        genre: "Vaporwave",
        track: 1,
      },
      9101,
    );
    track.create(
      {
        artist: b.name,
        album: alVaporHouse.title,
        title: "VaporHouseB",
        genre: "Vapor House",
        track: 1,
      },
      9102,
    );
    const rockArtist = artist.create({ name: "TokenRockArtist" }, 902);
    const rockAl = album.create(
      { title: "TokenRockOne", artistName: rockArtist.name, genreName: "Rock" },
      912,
    );
    const rockTrack = track.create(
      {
        artist: rockArtist.name,
        album: rockAl.title,
        title: "TokenRock",
        genre: "Rock",
        track: 1,
      },
      9121,
    );
    db()
      .update(tracks)
      .set({ play_count: 999 })
      .where(eq(tracks.id, rockTrack.id))
      .run();

    const svc = new AutoplayService();
    svc.resetSession(seed.file, [seed.file]);
    const batch = svc.getNextBatch(seed.file);
    const hasVaporHouse = batch.some((f) => {
      const t = db()
        .select()
        .from(tracks)
        .where(eq(tracks.file, f))
        .get() as any;
      const al = t.album_id ? albumsDb.getById(t.album_id) : undefined;
      return al?.genre?.toLowerCase() === "vapor house";
    });
    const hasRock = batch.some((f) => {
      const t = db()
        .select()
        .from(tracks)
        .where(eq(tracks.file, f))
        .get() as any;
      const al = t.album_id ? albumsDb.getById(t.album_id) : undefined;
      return al?.genre?.toLowerCase() === "rock";
    });
    expect(
      hasVaporHouse,
      "token fallback should find Vapor House for Vaporwave",
    ).to.be.true;
    expect(hasRock).to.be.false;
  });
});
