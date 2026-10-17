import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import {
  catalogSyncDb,
  tracksDb,
  artistsDb,
  albumsDb,
  genresDb,
  syncMetadataDb,
  playlistsDb,
  db,
  upsertTrack,
  tracks,
} from "@repo/db";

import { eq } from "drizzle-orm";

describe("catalogSyncDb (trophy integration)", () => {
  let close: () => void;
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => {
    sinon.restore();
    close();
  });

  function mkTrack(file: string, overrides: Record<string, unknown> = {}) {
    return {
      file,
      title: "Title",
      artist: "ArtistA",
      album: "AlbumA",
      genre: "Rock",
      duration: 200,
      track: "1",
      disc: "1",
      date: "2020-01-01",
      ...overrides,
    } as unknown as import("@repo/types").MPDTrack;
  }

  it("applyIncremental upserts changed tracks and preserves play_count", () => {
    const id = upsertTrack(db(), mkTrack("a/keep.mp3", { title: "Old" }));
    db().update(tracks).set({ play_count: 7 }).where(eq(tracks.id, id)).run();
    const res = catalogSyncDb.applyIncremental({
      upserts: [mkTrack("a/keep.mp3", { title: "New" })],
      deletions: [],
    });
    expect(res).to.deep.equal({ synced: 1, deleted: 0, errors: 0 });
    const row = tracksDb.getByFile("a/keep.mp3");
    expect(row?.title).to.equal("New");
    expect(row?.play_count).to.equal(7);
  });

  it("applyIncremental deletes only the listed files", () => {
    upsertTrack(db(), mkTrack("a/gone.mp3"));
    upsertTrack(db(), mkTrack("a/kept.mp3"));
    const res = catalogSyncDb.applyIncremental({
      upserts: [],
      deletions: ["a/gone.mp3"],
    });
    expect(res.deleted).to.equal(1);
    expect(tracksDb.getByFile("a/gone.mp3")).to.be.undefined;
    expect(tracksDb.getByFile("a/kept.mp3")).to.exist;
  });

  it("applyIncremental cascades playlist rows on delete", () => {
    const tid = upsertTrack(db(), mkTrack("a/p.mp3"));
    const pid = playlistsDb.create("P");
    playlistsDb.addTrack(pid, tid);
    catalogSyncDb.applyIncremental({ upserts: [], deletions: ["a/p.mp3"] });
    expect(playlistsDb.getTracks(pid)).to.have.length(0);
  });

  it("applyIncremental stamps scanner_version and last_sync", () => {
    catalogSyncDb.applyIncremental({ upserts: [], deletions: [] });
    expect(catalogSyncDb.getScannerVersion()).to.equal("1");
    expect(syncMetadataDb.get("last_sync")).to.be.a("string");
  });

  it("applyIncremental rolls back orphan lookup rows for a rejected track (savepoint)", () => {
    const stub = sinon.stub(console, "error");
    const valid = mkTrack("a/valid-inc.mp3", {
      artist: "KeepArtist",
      album: "KeepAlbum",
      genre: "KeepGenre",
    });
    // Invalid: file is null violates NOT NULL. It carries distinct lookup names
    // so any artist/album/genre it creates would be a detectable orphan.
    const invalid = {
      ...(mkTrack("a/invalid-inc.mp3", {
        artist: "OrphanArtist",
        album: "OrphanAlbum",
        genre: "OrphanGenre",
      }) as unknown as Record<string, unknown>),
      file: null,
    } as unknown as import("@repo/types").MPDTrack;
    const res = catalogSyncDb.applyIncremental({
      upserts: [valid, invalid],
      deletions: [],
    });
    expect(res.synced).to.equal(1);
    expect(res.errors).to.equal(1);
    expect(tracksDb.getByFile("a/valid-inc.mp3")).to.exist;
    expect(artistsDb.getAll().some((a) => a.name === "OrphanArtist")).to.be
      .false;
    expect(albumsDb.getAll().some((a) => a.title === "OrphanAlbum")).to.be
      .false;
    expect(genresDb.getAll().some((g) => g.name === "OrphanGenre")).to.be.false;
    expect(stub.calledOnce).to.be.true;
  });
});
