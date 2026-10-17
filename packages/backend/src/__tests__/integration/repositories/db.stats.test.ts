import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import {
  statsDb,
  playlistsDb,
  catalogSyncDb,
  db,
  upsertTrack,
  findOrCreateArtist,
  findOrCreateAlbum,
  findOrCreateGenre,
  tracks,
} from "@repo/db";

import { eq } from "drizzle-orm";

describe("statsDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("returns zeros when empty and null years/lastSync", () => {
    const s = statsDb.getStats();
    expect(s.totalTracks).to.equal(0);
    expect(s.totalArtists).to.equal(0);
    expect(s.totalAlbums).to.equal(0);
    expect(s.totalPlaylists).to.equal(0);
    expect(s.totalGenres).to.equal(0);
    expect(s.totalDuration).to.equal(0);
    expect(s.averageDuration).to.equal(0);
    expect(s.earliestYear).to.be.null;
    expect(s.latestYear).to.be.null;
    expect(s.tracksWithoutAlbum).to.equal(0);
    expect(s.lastSync).to.be.null;
  });

  it("counts tracks/artists/albums/playlists/genres", () => {
    findOrCreateArtist(db(), "A1");
    findOrCreateArtist(db(), "A2");
    findOrCreateAlbum(db(), "Al1");
    playlistsDb.create("Pl1");
    findOrCreateGenre(db(), "Rock");
    upsertTrack(db(), {
      file: "a/t1.mp3",
      title: "T1",
      artist: "A1",
      album: "Al1",
      genre: "Rock",
      duration: 100,
    } as never);
    const s = statsDb.getStats();
    expect(s.totalTracks).to.equal(1);
    expect(s.totalArtists).to.equal(2);
    expect(s.totalAlbums).to.equal(1);
    expect(s.totalPlaylists).to.equal(1);
    expect(s.totalGenres).to.equal(1);
  });

  it("sums duration and avg", () => {
    upsertTrack(db(), {
      file: "a/d1.mp3",
      title: "D1",
      artist: "A",
      album: "Al",
      duration: 100,
    } as never);
    upsertTrack(db(), {
      file: "a/d2.mp3",
      title: "D2",
      artist: "A",
      album: "Al",
      duration: 300,
    } as never);
    const s = statsDb.getStats();
    expect(s.totalDuration).to.equal(400);
    expect(s.averageDuration).to.equal(200);
  });

  it("parses earliest/latest year from date strings", () => {
    upsertTrack(db(), {
      file: "a/y1.mp3",
      title: "Y1",
      artist: "A",
      album: "Al1",
      date: "1999-01-01",
    } as never);
    upsertTrack(db(), {
      file: "a/y2.mp3",
      title: "Y2",
      artist: "A",
      album: "Al2",
      date: "2020-05-01",
    } as never);
    upsertTrack(db(), {
      file: "a/y3.mp3",
      title: "Y3",
      artist: "A",
      album: "Al3",
      date: "",
    } as never);
    const s = statsDb.getStats();
    expect(s.earliestYear).to.equal(1999);
    expect(s.latestYear).to.equal(2020);
  });

  it("ignores empty date for year", () => {
    upsertTrack(db(), {
      file: "a/e1.mp3",
      title: "E1",
      artist: "A",
      album: "Al",
      date: "",
    } as never);
    const s = statsDb.getStats();
    expect(s.earliestYear).to.be.null;
    expect(s.latestYear).to.be.null;
  });

  it("tracksWithoutAlbum counts null album_id", () => {
    const orphanId = db()
      .insert(tracks)
      .values({
        file: "orphan.mp3",
        title: "Orphan",
        artist_id: null,
        album_id: null,
      })
      .run().lastInsertRowid as number;
    void orphanId;
    upsertTrack(db(), {
      file: "a/with.mp3",
      title: "With",
      artist: "A",
      album: "Al",
    } as never);
    expect(statsDb.getStats().tracksWithoutAlbum).to.equal(1);
  });

  it("lastSync from syncMetadata", () => {
    catalogSyncDb.applyIncremental({ upserts: [], deletions: [] });
    expect(statsDb.getStats().lastSync).to.be.a("string");
  });

  it("handles null duration → coalesce 0", () => {
    const id = upsertTrack(db(), {
      file: "a/nulldur.mp3",
      title: "NullDur",
      artist: "A",
      album: "Al",
    } as never);
    db().update(tracks).set({ duration: null }).where(eq(tracks.id, id)).run();
    const s = statsDb.getStats();
    expect(s.totalDuration).to.equal(0);
    expect(s.averageDuration).to.equal(0);
  });
});
