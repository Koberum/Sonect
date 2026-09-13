import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { track, artist, album } from "@tests/factories/index.js";
import { tracksDb, albumsDb } from "@repo/db";

describe("Service + real DB integration (trophy middle layer)", () => {
  let close: () => void;

  beforeEach(() => {
    ({ close } = createTestDb());
  });

  afterEach(() => {
    close();
  });

  it("track.create() persists a faker-seeded typed DBTrack", () => {
    const t = track.create();
    expect(t.id).to.be.a("number");
    expect(t.file).to.be.a("string");
    expect(t.title).to.be.a("string");
    expect(t.play_count).to.be.a("number");
    const fetched = tracksDb.getById(t.id);
    expect(fetched?.title).to.equal(t.title);
  });

  it("track.create() respects overrides and seeded faker", () => {
    const t1 = track.create({ title: "Fixed" }, 42);
    const t2 = track.create({ title: "Fixed" }, 42);
    // same seed + same override => same generated artist/album/file suffix differs due to faker sequence but title is fixed
    expect(t1.title).to.equal("Fixed");
    expect(t2.title).to.equal("Fixed");
  });

  it("tracksDb.search finds seeded tracks", () => {
    track.create({ title: "ZUniqueSearchXYZ", artist: "SearchArtist" });
    track.create({ title: "Other" });
    const results = tracksDb.search("ZUniqueSearchXYZ");
    expect(results).to.have.length(1);
    expect(results[0].title).to.equal("ZUniqueSearchXYZ");
  });

  it("tracksDb.getTopTracks orders by play_count", () => {
    track.create({ title: "Low", play_count: 1 });
    track.create({ title: "High", play_count: 99 });
    const top = tracksDb.getTopTracks(1);
    expect(top[0].title).to.equal("High");
  });

  it("incrementPlayCount updates play_count", () => {
    const t = track.create({ play_count: 2 });
    tracksDb.incrementPlayCount(t.id);
    const updated = tracksDb.getById(t.id);
    expect(updated?.play_count).to.equal(3);
  });

  it("upsert is idempotent on file (re-seed same file updates)", () => {
    const payload = track.build({ file: "a/b/same.mp3", title: "First" });
    const id1 = tracksDb.upsert(payload);
    const id2 = tracksDb.upsert({ ...payload, title: "Second" });
    expect(id1).to.equal(id2);
    expect(tracksDb.getById(id1)?.title).to.equal("Second");
  });

  it("artist.create + album.create link correctly", () => {
    const a = artist.create({ name: "IntegrationArtist" });
    const al = album.create({ title: "IntegrationAlbum", artistName: a.name });
    expect(al.title).to.equal("IntegrationAlbum");
    const fetched = albumsDb.getById(al.id);
    expect(fetched?.artist_name).to.equal(a.name);
  });

  it("track.createMany seeds N tracks", () => {
    const many = track.createMany(5);
    expect(many).to.have.length(5);
    expect(tracksDb.count()).to.equal(5);
  });

  it("transaction-rollback not needed: fresh :memory: per test isolates data", () => {
    // previous test inserted 5, but this test gets fresh DB
    expect(tracksDb.count()).to.equal(0);
    track.create();
    expect(tracksDb.count()).to.equal(1);
  });
});
