import { expect } from "chai";
import sinon from "sinon";
import { eq } from "drizzle-orm";
import { db, likedDb, profilesDb, tracks, tracksDb } from "@repo/db";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";

describe("likedDb (trophy integration)", () => {
  let close: () => void;
  let sandbox: sinon.SinonSandbox;
  let profileId: string;
  let otherProfileId: string;

  beforeEach(() => {
    ({ close } = createTestDb());
    sandbox = sinon.createSandbox();
    sandbox.useFakeTimers({ now: 1_700_000_000_000 });
    profileId = profilesDb.create({
      name: "Listener",
      passwordHash: "hash",
    });
    otherProfileId = profilesDb.create({
      name: "Other",
      passwordHash: "hash",
    });
  });

  afterEach(() => {
    sandbox.restore();
    close();
  });

  function seedTrack(title: string, seed: number) {
    const a = artist.create({ name: `Artist${seed}` }, seed);
    const al = album.create(
      { title: `Album${seed}`, artistName: a.name },
      seed,
    );
    return track.create(
      {
        artist: a.name,
        album: al.title,
        title,
        file: `${a.name}/${title}.mp3`,
      },
      seed,
    );
  }

  it("adds, lists, and reads back liked tracks with relations", () => {
    const t = seedTrack("LikedOne", 1);

    likedDb.add(profileId, t.id);

    const list = likedDb.list(profileId);
    expect(list).to.have.length(1);
    expect(list[0]).to.include({
      id: t.id,
      title: "LikedOne",
      file: t.file,
    });
    expect(list[0].artist_name).to.be.a("string");
    expect(list[0].album_title).to.be.a("string");
    expect(likedDb.ids(profileId)).to.deep.equal([t.id]);
    expect(likedDb.files(profileId)).to.deep.equal([t.file]);
  });

  it("is idempotent when liking the same track twice", () => {
    const t = seedTrack("Twice", 2);

    expect(likedDb.add(profileId, t.id)).to.equal(true);
    expect(likedDb.add(profileId, t.id)).to.equal(false);

    expect(likedDb.list(profileId)).to.have.length(1);
    expect(likedDb.summary(profileId).count).to.equal(1);
  });

  it("removes a like and is a no-op for an unliked track", () => {
    const t = seedTrack("RemoveMe", 3);
    likedDb.add(profileId, t.id);

    expect(likedDb.remove(profileId, t.id)).to.equal(true);
    expect(likedDb.remove(profileId, t.id)).to.equal(false);
    expect(likedDb.list(profileId)).to.deep.equal([]);
  });

  it("keeps likes isolated per profile", () => {
    const t = seedTrack("Mine", 4);

    likedDb.add(profileId, t.id);

    expect(likedDb.ids(profileId)).to.deep.equal([t.id]);
    expect(likedDb.ids(otherProfileId)).to.deep.equal([]);
    expect(likedDb.list(otherProfileId)).to.deep.equal([]);
  });

  it("orders newest likes first and paginates", () => {
    const first = seedTrack("First", 5);
    const second = seedTrack("Second", 6);
    const third = seedTrack("Third", 7);

    likedDb.add(profileId, first.id);
    sandbox.clock.tick(1_000);
    likedDb.add(profileId, second.id);
    sandbox.clock.tick(1_000);
    likedDb.add(profileId, third.id);

    expect(likedDb.list(profileId).map((t) => t.title)).to.deep.equal([
      "Third",
      "Second",
      "First",
    ]);
    expect(
      likedDb.list(profileId, { limit: 2, offset: 0 }).map((t) => t.title),
    ).to.deep.equal(["Third", "Second"]);
    expect(
      likedDb.list(profileId, { limit: 2, offset: 2 }).map((t) => t.title),
    ).to.deep.equal(["First"]);
  });

  it("summarizes count and total duration", () => {
    const first = seedTrack("Short", 8);
    const second = seedTrack("Long", 9);
    db()
      .update(tracks)
      .set({ duration: 125.5 })
      .where(eq(tracks.id, first.id))
      .run();
    db()
      .update(tracks)
      .set({ duration: 200 })
      .where(eq(tracks.id, second.id))
      .run();

    likedDb.add(profileId, first.id);
    likedDb.add(profileId, second.id);

    expect(likedDb.summary(profileId)).to.deep.equal({
      count: 2,
      totalDuration: 325.5,
    });
  });

  it("cascades likes when a track is deleted", () => {
    const t = seedTrack("Gone", 10);
    likedDb.add(profileId, t.id);

    db().delete(tracks).where(eq(tracks.id, t.id)).run();

    expect(likedDb.list(profileId)).to.deep.equal([]);
    expect(tracksDb.getById(t.id)).to.be.undefined;
  });
});
