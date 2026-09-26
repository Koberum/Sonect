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
} from "@repo/db";
import { db } from "@repo/db";
import { tracks } from "@repo/db";
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
      lastModified: "2020-01-01T00:00:00Z",
      ...overrides,
    } as unknown as import("@repo/types").MPDTrack;
  }

  it("rebuild empty list clears and stamps timestamp", () => {
    tracksDb.upsert(mkTrack("a/old.mp3"));
    const res = catalogSyncDb.rebuild([]);
    expect(res).to.deep.equal({ synced: 0, errors: 0 });
    expect(tracksDb.count()).to.equal(0);
    expect(artistsDb.count()).to.equal(0);
    expect(albumsDb.count()).to.equal(0);
    expect(syncMetadataDb.get("last_sync")).to.be.a("string");
  });

  it("rebuild inserts tracks and creates relations", () => {
    const res = catalogSyncDb.rebuild([
      mkTrack("a/t1.mp3", { title: "T1" }),
      mkTrack("a/t2.mp3", { title: "T2" }),
    ]);
    expect(res.synced).to.equal(2);
    expect(res.errors).to.equal(0);
    expect(tracksDb.count()).to.equal(2);
    expect(tracksDb.getByFile("a/t1.mp3")?.title).to.equal("T1");
  });

  it("rebuild preserves play_count/last_played for surviving files", () => {
    const id = tracksDb.upsert(mkTrack("a/keep.mp3", { title: "Keep" }));
    db()
      .update(tracks)
      .set({ play_count: 42, last_played: "2020-01-01 00:00:00" })
      .where(eq(tracks.id, id))
      .run();
    catalogSyncDb.rebuild([mkTrack("a/keep.mp3", { title: "KeepNew" })]);
    const row = tracksDb.getByFile("a/keep.mp3");
    expect(row?.play_count).to.equal(42);
    expect(row?.last_played).to.equal("2020-01-01 00:00:00");
    expect(row?.title).to.equal("KeepNew");
  });

  it("rebuild does not preserve stats for non-surviving files", () => {
    tracksDb.upsert(mkTrack("a/gone.mp3"));
    const id = tracksDb.getByFile("a/gone.mp3")!.id;
    db().update(tracks).set({ play_count: 99 }).where(eq(tracks.id, id)).run();
    catalogSyncDb.rebuild([mkTrack("a/new.mp3")]);
    expect(tracksDb.getByFile("a/gone.mp3")).to.be.undefined;
    expect(tracksDb.getByFile("a/new.mp3")?.play_count).to.equal(0);
  });

  it("onProgress called per synced track with synced count and track", () => {
    const spy = sinon.stub();
    catalogSyncDb.rebuild([mkTrack("a/p1.mp3"), mkTrack("a/p2.mp3")], spy);
    expect(spy.callCount).to.equal(2);
    expect(spy.firstCall.args[0]).to.equal(1);
    expect(spy.secondCall.args[0]).to.equal(2);
    expect(spy.firstCall.args[1].file).to.equal("a/p1.mp3");
  });

  it("rebuild wipes previous artists/albums/genres FK-safe", () => {
    tracksDb.upsert(
      mkTrack("a/old.mp3", {
        artist: "OldArtist",
        album: "OldAlbum",
        genre: "OldGenre",
      }),
    );
    catalogSyncDb.rebuild([
      mkTrack("a/new.mp3", {
        artist: "NewArtist",
        album: "NewAlbum",
        genre: "NewGenre",
      }),
    ]);
    expect(tracksDb.getByFile("a/old.mp3")).to.be.undefined;
    expect(artistsDb.getAll().some((a) => a.name === "OldArtist")).to.be.false;
    expect(genresDb.getAll().some((g) => g.name === "OldGenre")).to.be.false;
  });

  it("per-track constraint error is counted and skipped (savepoint)", () => {
    const stub = sinon.stub(console, "error");
    // Valid track
    const valid = mkTrack("a/valid.mp3");
    // Invalid: file is null violates NOT NULL — will trigger constraint failed
    const invalid = {
      ...(mkTrack("a/invalid.mp3") as unknown as Record<string, unknown>),
      file: null,
    } as unknown as import("@repo/types").MPDTrack;
    const res = catalogSyncDb.rebuild([valid, invalid]);
    expect(res.synced).to.equal(1);
    expect(res.errors).to.equal(1);
    expect(tracksDb.count()).to.equal(1);
    expect(tracksDb.getByFile("a/valid.mp3")).to.exist;
    expect(stub.calledOnce).to.be.true;
  });

  it("non-constraint error rethrows and rolls back entire rebuild", () => {
    tracksDb.upsert(mkTrack("a/before.mp3", { title: "Before" }));
    let threw = false;
    try {
      catalogSyncDb.rebuild([mkTrack("a/after.mp3")], () => {
        throw new Error("progress boom");
      });
    } catch (e) {
      threw = true;
      expect((e as Error).message).to.equal("progress boom");
    }
    expect(threw).to.be.true;
    // rolled back to previous state
    expect(tracksDb.getByFile("a/before.mp3")?.title).to.equal("Before");
    expect(tracksDb.getByFile("a/after.mp3")).to.be.undefined;
  });

  it("clearAll wipes all music tables", () => {
    tracksDb.upsert(mkTrack("a/clear.mp3"));
    syncMetadataDb.set("last_sync", "x");
    catalogSyncDb.clearAll();
    expect(tracksDb.count()).to.equal(0);
    expect(artistsDb.count()).to.equal(0);
    expect(albumsDb.count()).to.equal(0);
    expect(syncMetadataDb.get("last_sync")).to.be.undefined;
  });

  it("rebuild sets last_sync timestamp inside transaction", () => {
    catalogSyncDb.rebuild([mkTrack("a/ts.mp3")]);
    const v = syncMetadataDb.get("last_sync");
    expect(new Date(v!).getTime()).to.be.closeTo(Date.now(), 2000);
  });
});
