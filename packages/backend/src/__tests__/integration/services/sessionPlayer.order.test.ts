import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { SessionPlayer } from "@services/session/sessionPlayer.js";
import type { AutoplayService } from "@services/mpd/autoplayService.js";
import type { LogService } from "@services/utils/logService";

const reverse = <T>(items: readonly T[]): T[] => [...items].reverse();
const identity = <T>(items: readonly T[]): T[] => [...items];

describe("SessionPlayer shuffle and repeat", () => {
  let close: () => void;
  let p: SessionPlayer | undefined;

  beforeEach(() => {
    ({ close } = createTestDb());
  });

  afterEach(() => {
    p?.stop();
    close();
  });

  function seedThreeTracks(name: string, seed: number) {
    const a = artist.create({ name }, seed);
    const al = album.create(
      { title: `${name}Album`, artistName: a.name },
      seed,
    );
    const t1 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "X",
        duration: 4,
        track: 1,
        disc: "1",
      },
      seed + 1,
    );
    const t2 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "Y",
        duration: 4,
        track: 2,
        disc: "1",
      },
      seed + 2,
    );
    const t3 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "Z",
        duration: 4,
        track: 3,
        disc: "1",
      },
      seed + 3,
    );
    return { t1, t2, t3 };
  }

  it("keeps the current track first and follows the shuffled order", () => {
    const { t1, t2, t3 } = seedThreeTracks("ShuffleArtist", 100);
    p = new SessionPlayer("S-shuffle", {} as LogService, undefined, reverse);
    p.setRandom(true);
    p.playTrack(t1.file);

    expect(p.getStatus().random).to.equal(true);
    expect(p.getStatus().nextTrackId).to.equal(t3.id);

    p.reportPlayback({ event: "ended" });
    expect(p.getStatus().track?.id).to.equal(t3.id);
    expect(p.getStatus().nextTrackId).to.equal(t2.id);
  });

  it("returns to the natural order when shuffle is disabled", () => {
    const { t1, t2 } = seedThreeTracks("UnshuffleArtist", 200);
    p = new SessionPlayer("S-unshuffle", {} as LogService, undefined, reverse);
    p.setRandom(true);
    p.playTrack(t1.file);

    expect(p.getStatus().nextTrackId).not.to.equal(t2.id);
    p.setRandom(false);
    expect(p.getStatus().random).to.equal(false);
    expect(p.getStatus().nextTrackId).to.equal(t2.id);
  });

  it("wraps the queue when repeat is all", () => {
    const { t1, t2, t3 } = seedThreeTracks("RepeatAllArtist", 300);
    p = new SessionPlayer(
      "S-repeat-all",
      {} as LogService,
      undefined,
      identity,
    );
    p.setRepeatMode("all");
    p.playTrack(t1.file);

    expect(p.getStatus().repeatMode).to.equal("all");
    expect(p.getStatus().repeat).to.equal(true);
    expect(p.getStatus().single).to.equal(false);

    expect(p.getStatus().nextTrackId).to.equal(t2.id);
    p.reportPlayback({ event: "ended" });
    p.reportPlayback({ event: "ended" });
    expect(p.getStatus().track?.id).to.equal(t3.id);
    expect(p.getStatus().nextTrackId).to.equal(t1.id);

    p.reportPlayback({ event: "ended" });
    expect(p.getStatus().track?.id).to.equal(t1.id);
    expect(p.getStatus().state).to.equal("play");
  });

  it("repeats the current track when repeat is one", () => {
    const { t1 } = seedThreeTracks("RepeatOneArtist", 400);
    p = new SessionPlayer(
      "S-repeat-one",
      {} as LogService,
      undefined,
      identity,
    );
    p.setRepeatMode("one");
    p.playTrack(t1.file);

    const status = p.getStatus();
    expect(status.repeatMode).to.equal("one");
    expect(status.single).to.equal(true);
    expect(status.nextTrackId).to.equal(t1.id);

    p.reportPlayback({ event: "ended" });
    expect(p.getStatus().track?.id).to.equal(t1.id);
    expect(p.getStatus().state).to.equal("play");
    expect(p.getStatus().elapsed).to.equal(0);
  });

  it("advances on explicit next in repeat-one and wraps previous", () => {
    const { t1, t2, t3 } = seedThreeTracks("RepeatOneNext", 550);
    p = new SessionPlayer(
      "S-repeat-one-next",
      {} as LogService,
      undefined,
      identity,
    );
    p.setRepeatMode("one");
    p.playTrack(t1.file);

    p.next();
    expect(p.getStatus().track?.id).to.equal(t2.id);
    p.next();
    expect(p.getStatus().track?.id).to.equal(t3.id);
    p.next();
    expect(p.getStatus().track?.id).to.equal(t1.id);
    p.previous();
    expect(p.getStatus().track?.id).to.equal(t3.id);
  });

  it("keeps autoplay running through a shuffled pass", () => {
    const a = artist.create({ name: "ShuffledAutoplay" }, 560);
    const al = album.create(
      { title: "ShuffledAutoplayAlbum", artistName: a.name },
      560,
    );
    const tracks = Array.from({ length: 10 }, (_, i) =>
      track.create(
        {
          artist: a.name,
          album: al.title,
          title: `T${i + 1}`,
          duration: 4,
          track: i + 1,
          disc: "1",
        },
        561 + i,
      ),
    );
    const extraArtist = artist.create({ name: "ShuffledExtra" }, 580);
    const extraAlbum = album.create(
      { title: "ShuffledExtraAlbum", artistName: extraArtist.name },
      580,
    );
    const extra = track.create(
      {
        artist: extraArtist.name,
        album: extraAlbum.title,
        title: "Extra",
        duration: 4,
      },
      581,
    );

    const getNextBatch = sinon
      .stub()
      .onFirstCall()
      .returns([])
      .onSecondCall()
      .returns([extra.file])
      .returns([]);
    const autoplay = {
      sessionId: 1,
      resetSession: sinon.stub().returns(1),
      getNextBatch,
      commitBatch: sinon.stub(),
    } as unknown as AutoplayService;

    p = new SessionPlayer(
      "S-shuffled-autoplay",
      {} as LogService,
      autoplay,
      reverse,
    );
    p.setRandom(true);
    p.playTrack(tracks[0].file);

    for (let i = 0; i < 9; i += 1) {
      p.reportPlayback({ event: "ended" });
    }

    expect(p.getStatus().state).to.equal("play");
    expect(getNextBatch.callCount).to.be.greaterThan(1);
    expect(p.getStatus().queueLength).to.equal(11);
  });

  it("advances to the track the browser reported even when a refill is due", () => {
    const { t1 } = seedThreeTracks("ReportedAdvance", 590);
    const extraArtist = artist.create({ name: "ReportedExtra" }, 600);
    const extraAlbum = album.create(
      { title: "ReportedExtraAlbum", artistName: extraArtist.name },
      600,
    );
    const extra = track.create(
      {
        artist: extraArtist.name,
        album: extraAlbum.title,
        title: "Extra",
        duration: 4,
      },
      601,
    );
    const autoplay = {
      sessionId: 1,
      resetSession: sinon.stub().returns(1),
      getNextBatch: sinon
        .stub()
        .onFirstCall()
        .returns([])
        .onSecondCall()
        .returns([extra.file]),
      commitBatch: sinon.stub(),
    } as unknown as AutoplayService;

    p = new SessionPlayer(
      "S-reported-advance",
      {} as LogService,
      autoplay,
      identity,
    );
    p.setRandom(true);
    p.playTrack(t1.file);
    const expected = p.getStatus().nextTrackId;

    p.reportPlayback({ event: "advance", trackId: expected ?? undefined });

    expect(p.getStatus().track?.id).to.equal(expected);
  });

  it("suspends autoplay while repeat is active and resumes when off", () => {
    const { t1 } = seedThreeTracks("AutoplayRepeat", 500);
    const a = artist.create({ name: "ExtraArtist" }, 600);
    const al = album.create({ title: "ExtraAlbum", artistName: a.name }, 600);
    const extra = track.create(
      { artist: a.name, album: al.title, title: "Extra", duration: 4 },
      601,
    );

    const autoplay = {
      sessionId: 1,
      resetSession: sinon.stub().returns(1),
      getNextBatch: sinon.stub().returns([extra.file]),
      commitBatch: sinon.stub(),
    } as unknown as AutoplayService;

    p = new SessionPlayer(
      "S-repeat-autoplay",
      {} as LogService,
      autoplay,
      identity,
    );
    p.setRepeatMode("all");
    p.playTrack(t1.file);
    expect(p.getStatus().queueLength).to.equal(3);

    p.reportPlayback({ state: "play", elapsed: 1 });
    expect(p.getStatus().queueLength).to.equal(3);

    p.setRepeatMode("off");
    p.reportPlayback({ state: "play", elapsed: 2 });
    expect(p.getStatus().queueLength).to.equal(4);
  });
});
