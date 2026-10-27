import { EventEmitter } from "events";
import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { PlayTrackingService } from "@services/player/playTrackingService.js";
import { albumsDb, playHistoryDb, profilesDb, tracksDb } from "@repo/db";
import { track } from "@tests/factories/index.js";

describe("PlayTrackingService (trophy integration)", () => {
  let close: () => void;
  let router: EventEmitter;
  let profileA: string;
  let profileB: string;

  beforeEach(() => {
    ({ close } = createTestDb());
    profileA = profilesDb.create({ name: "A", passwordHash: "hash" });
    profileB = profilesDb.create({ name: "B", passwordHash: "hash" });
    router = new EventEmitter();
    new PlayTrackingService(router).start();
  });
  afterEach(() => close());

  it("records plays per profile and updates global counters", () => {
    const t = track.create({ title: "Track" }, 1);

    router.emit("trackChanged", { sessionId: profileA, track: t });

    expect(playHistoryDb.recentTracks(profileA, 10).map((r) => r.id)).to.deep.equal([
      t.id,
    ]);
    expect(playHistoryDb.recentTracks(profileB, 10)).to.deep.equal([]);
    expect(tracksDb.getById(t.id)?.play_count).to.equal(1);
    expect(albumsDb.getById(t.album_id!)?.last_played).to.be.a("string");
  });

  it("ignores tracks that are not in the catalog", () => {
    expect(() =>
      router.emit("trackChanged", {
        sessionId: profileA,
        track: { id: 999999, album_id: 123 },
      }),
    ).to.not.throw();
    expect(playHistoryDb.hasHistory(profileA)).to.be.false;
  });

  it("debounces the same track per profile but not across profiles", () => {
    const t = track.create({ title: "Track" }, 2);

    router.emit("trackChanged", { sessionId: profileA, track: t });
    router.emit("trackChanged", { sessionId: profileA, track: t });
    router.emit("trackChanged", { sessionId: profileB, track: t });

    expect(playHistoryDb.recentTracks(profileA, 10)).to.have.length(1);
    expect(playHistoryDb.recentTracks(profileB, 10)).to.have.length(1);
  });
});
