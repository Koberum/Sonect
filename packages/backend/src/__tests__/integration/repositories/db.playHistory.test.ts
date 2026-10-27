import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { playHistoryDb, profilesDb } from "@repo/db";
import { track } from "@tests/factories/index.js";

describe("playHistoryDb (trophy integration)", () => {
  let close: () => void;
  let profileA: string;
  let profileB: string;

  beforeEach(() => {
    ({ close } = createTestDb());
    profileA = profilesDb.create({ name: "A", passwordHash: "hash" });
    profileB = profilesDb.create({ name: "B", passwordHash: "hash" });
  });
  afterEach(() => close());

  it("record + hasHistory", () => {
    expect(playHistoryDb.hasHistory(profileA)).to.be.false;
    const t = track.create({ title: "One" }, 1);
    playHistoryDb.record(profileA, t.id, 1000);
    expect(playHistoryDb.hasHistory(profileA)).to.be.true;
    expect(playHistoryDb.hasHistory(profileB)).to.be.false;
  });

  it("isolates recent tracks/albums/artists per profile", () => {
    const t1 = track.create(
      { title: "One", artist: "Artist A", album: "Album A" },
      2,
    );
    const t2 = track.create(
      { title: "Two", artist: "Artist B", album: "Album B" },
      3,
    );
    playHistoryDb.record(profileA, t1.id, 1000);
    playHistoryDb.record(profileB, t2.id, 2000);
    playHistoryDb.record(profileA, t2.id, 3000);

    expect(playHistoryDb.recentTracks(profileA, 10).map((t) => t.id)).to.deep.equal([
      t2.id,
      t1.id,
    ]);
    expect(playHistoryDb.recentTracks(profileB, 10).map((t) => t.id)).to.deep.equal(
      [t2.id],
    );
    expect(
      playHistoryDb.recentAlbums(profileA, 10).map((a) => a.title),
    ).to.deep.equal(["Album B", "Album A"]);
    expect(
      playHistoryDb.recentArtists(profileA, 10).map((a) => a.name),
    ).to.deep.equal(["Artist B", "Artist A"]);
  });

  it("orders top tracks/genres/artists by the profile's play counts", () => {
    const rock = track.create({ title: "Rock", genre: "Rock", artist: "R" }, 4);
    const jazz = track.create({ title: "Jazz", genre: "Jazz", artist: "J" }, 5);
    playHistoryDb.record(profileA, rock.id, 1000);
    playHistoryDb.record(profileA, rock.id, 2000);
    playHistoryDb.record(profileA, jazz.id, 3000);
    playHistoryDb.record(profileB, jazz.id, 4000);
    playHistoryDb.record(profileB, jazz.id, 5000);

    expect(playHistoryDb.topTracks(profileA, 10).map((t) => t.title)).to.deep.equal(
      ["Rock", "Jazz"],
    );
    expect(playHistoryDb.topGenres(profileA, 3)).to.deep.equal(["Rock", "Jazz"]);
    expect(playHistoryDb.topGenre(profileB)).to.equal("Jazz");
    expect(playHistoryDb.topArtists(profileA, 3)[0]).to.include({
      name: "R",
      total: 2,
    });
  });

  it("discovery excludes tracks played 3+ times by the profile", () => {
    const played = track.create(
      { title: "Played", genre: "Rock", artist: "R" },
      6,
    );
    const fresh = track.create({ title: "Fresh", genre: "Rock", artist: "R" }, 7);
    for (const at of [1000, 2000, 3000]) {
      playHistoryDb.record(profileA, played.id, at);
    }

    const ids = playHistoryDb
      .discoveryTracks(profileA, ["Rock"], [], 10)
      .map((t) => t.id);
    expect(ids).to.include(fresh.id);
    expect(ids).to.not.include(played.id);
  });
});
