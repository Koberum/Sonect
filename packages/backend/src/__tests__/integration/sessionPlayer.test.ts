import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { SessionPlayer } from "@services/session/sessionPlayer.js";
import type { LogService } from "@services/utils/logService";

describe("SessionPlayer", () => {
  let close: () => void;
  let p: SessionPlayer | undefined;

  beforeEach(() => {
    ({ close } = createTestDb());
  });

  afterEach(() => {
    p?.stop(); // clear the tick timer so the process can exit
    close();
  });

  it("playTrack builds album-through-end queue and starts at position 0", () => {
    const a = artist.create({ name: "SoloArtist" }, 1);
    const al = album.create({ title: "OneAlbum", artistName: a.name }, 1);
    const t1 = track.create(
      { artist: a.name, album: al.title, title: "A", track: 1 },
      2,
    );
    track.create({ artist: a.name, album: al.title, title: "B", track: 2 }, 3);
    track.create({ artist: a.name, album: al.title, title: "C", track: 3 }, 4);

    p = new SessionPlayer("sid-1", {} as LogService);
    p.playTrack(t1.file);

    const q = p.getQueue();
    expect(q.map((e) => e.title)).to.deep.equal(["A", "B", "C"]);
    const s = p.getStatus();
    expect(s.state).to.equal("play");
    expect(s.elapsed).to.equal(0);
  });

  it("advances position with a 1s tick and auto-advances at duration boundary", () => {
    const a = artist.create({ name: "TickArtist" }, 10);
    const al = album.create({ title: "TickAlbum", artistName: a.name }, 10);
    const t1 = track.create(
      { artist: a.name, album: al.title, title: "X", duration: 4 },
      211,
    );
    track.create(
      { artist: a.name, album: al.title, title: "Y", duration: 4 },
      212,
    );
    track.create(
      { artist: a.name, album: al.title, title: "Z", duration: 4 },
      213,
    );

    p = new SessionPlayer("S-2", {} as LogService);
    p.playTrack(t1.file);
    // elapse 3 ticks
    for (let i = 0; i < 3; i++) p.tick(); // manual hook exposed for tests + tick timer
    expect(p.getStatus().elapsed).to.equal(3);
    p.tick(); // 4th tick crosses the 4s duration -> advance() resets to next track
    const st = p.getStatus();
    expect(st.elapsed).to.equal(0); // advanced to next track
    expect(st.track?.title).to.equal("Y");
  });

  it("pause/resume/next/previous/seek", () => {
    const a = artist.create({ name: "CtlArtist" }, 20);
    const al = album.create({ title: "CtlAlbum", artistName: a.name }, 20);
    const t1 = track.create(
      { artist: a.name, album: al.title, title: "U", duration: 10 },
      221,
    );
    track.create(
      { artist: a.name, album: al.title, title: "V", duration: 11 },
      222,
    );

    p = new SessionPlayer("S-3", {} as LogService);
    p.playTrack(t1.file);
    p.pause();
    expect(p.getStatus().state).to.equal("pause");
    p.resume();
    expect(p.getStatus().state).to.equal("play");
    p.next();
    expect(p.getStatus().track?.title).to.equal("V");
    p.previous();
    expect(p.getStatus().track?.title).to.equal("U");
    p.seek(5);
    expect(p.getStatus().elapsed).to.equal(5);
    p.seek(500); // clamped to duration
    expect(p.getStatus().elapsed).to.equal(10);
  });

  it("removeFromQueue and moveQueueItem adjust the index", () => {
    const a = artist.create({ name: "QArtist" }, 30);
    const al = album.create({ title: "QAlbum", artistName: a.name }, 30);
    const t1 = track.create(
      { artist: a.name, album: al.title, title: "R", track: 1 },
      231,
    );
    track.create(
      { artist: a.name, album: al.title, title: "S", track: 2 },
      232,
    );
    const t3 = track.create(
      { artist: a.name, album: al.title, title: "T", track: 3 },
      233,
    );

    p = new SessionPlayer("S-4", {} as LogService);
    p.playTrack(t1.file);
    p.removeFromQueue(2); // drop T
    expect(p.getQueue().map((e) => e.title)).to.deep.equal(["R", "S"]);
    p.addToQueue(t3.file);
    p.moveQueueItem(2, 1);
    expect(p.getQueue().map((e) => e.title)).to.deep.equal(["R", "T", "S"]);
  });
});
