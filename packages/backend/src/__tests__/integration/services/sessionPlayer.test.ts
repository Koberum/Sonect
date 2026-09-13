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

  it("removing the current track advances to the next at position 0 (or stops when empty)", () => {
    const a = artist.create({ name: "RmArtist" }, 41);
    const al = album.create({ title: "RmAlbum", artistName: a.name }, 42);
    const t1 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "R1",
        track: 1,
        duration: 60,
        disc: "1",
      },
      43,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "R2",
        track: 2,
        duration: 60,
        disc: "1",
      },
      44,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "R3",
        track: 3,
        duration: 60,
        disc: "1",
      },
      45,
    );

    p = new SessionPlayer("S-5", {} as LogService);
    p.playTrack(t1.file);
    p.seek(10);
    expect(p.getStatus().elapsed).to.equal(10);

    // Remove the current (mid-queue) item: the next item takes over at 0.
    p.removeFromQueue(0);
    let s = p.getStatus();
    expect(p.getQueue().map((e) => e.title)).to.deep.equal(["R2", "R3"]);
    expect(s.state).to.equal("play");
    expect(s.track?.title).to.equal("R2");
    expect(s.elapsed).to.equal(0);

    // Remove it again: last remaining item becomes current at 0.
    p.removeFromQueue(0);
    s = p.getStatus();
    expect(p.getQueue().map((e) => e.title)).to.deep.equal(["R3"]);
    expect(s.track?.title).to.equal("R3");
    expect(s.elapsed).to.equal(0);

    // Remove the last item while it is current: queue empties -> stop.
    p.removeFromQueue(0);
    s = p.getStatus();
    expect(s.state).to.equal("stop");
    expect(s.queueLength).to.equal(0);
    expect(s.elapsed).to.equal(0);
    expect(s.track).to.be.undefined;
    expect(p.state).to.equal("stop");
  });

  it("removing the current tail item jumps back to the previous one at position 0", () => {
    const a = artist.create({ name: "TailArtist" }, 46);
    const al = album.create({ title: "TailAlbum", artistName: a.name }, 47);
    const t1 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "T1",
        track: 1,
        duration: 60,
        disc: "1",
      },
      48,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "T2",
        track: 2,
        duration: 60,
        disc: "1",
      },
      49,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "T3",
        track: 3,
        duration: 60,
        disc: "1",
      },
      50,
    );

    p = new SessionPlayer("S-6", {} as LogService);
    p.playTrack(t1.file);
    p.next();
    p.next(); // now on T3 (index 2, the tail)
    p.seek(5);
    expect(p.getStatus().track?.title).to.equal("T3");

    p.removeFromQueue(2);
    const s = p.getStatus();
    expect(p.getQueue().map((e) => e.title)).to.deep.equal(["T1", "T2"]);
    expect(s.state).to.equal("play");
    expect(s.track?.title).to.equal("T2");
    expect(s.elapsed).to.equal(0);
  });

  it("moveQueueItem keeps the cursor on a moved playing item and shifts the index", () => {
    const a = artist.create({ name: "MvArtist" }, 51);
    const al = album.create({ title: "MvAlbum", artistName: a.name }, 52);
    const t1 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "M1",
        track: 1,
        duration: 60,
        disc: "1",
      },
      53,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "M2",
        track: 2,
        duration: 60,
        disc: "1",
      },
      54,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "M3",
        track: 3,
        duration: 60,
        disc: "1",
      },
      55,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "M4",
        track: 4,
        duration: 60,
        disc: "1",
      },
      56,
    );

    p = new SessionPlayer("S-7", {} as LogService);
    p.playTrack(t1.file); // playing M1 (index 0)

    // Playing item moved: the cursor follows it to the new slot.
    p.moveQueueItem(0, 3);
    expect(p.getQueue().map((e) => e.title)).to.deep.equal([
      "M2",
      "M3",
      "M4",
      "M1",
    ]);
    expect(p.getStatus().track?.title).to.equal("M1");
  });

  it("moveQueueItem shifts the cursor down when a non-playing item moves forward across it", () => {
    const a = artist.create({ name: "FwArtist" }, 57);
    const al = album.create({ title: "FwAlbum", artistName: a.name }, 58);
    const t1 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "F1",
        track: 1,
        duration: 60,
        disc: "1",
      },
      59,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "F2",
        track: 2,
        duration: 60,
        disc: "1",
      },
      60,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "F3",
        track: 3,
        duration: 60,
        disc: "1",
      },
      61,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "F4",
        track: 4,
        duration: 60,
        disc: "1",
      },
      62,
    );

    p = new SessionPlayer("S-8", {} as LogService);
    p.playTrack(t1.file); // [F1,F2,F3,F4]
    for (let i = 0; i < 3; i++) p.next(); // now on F4 (index 3)
    expect(p.getStatus().track?.title).to.equal("F4");

    // Move F3 (index 2) forward into F4's slot (to 3): the playing index
    // shifts back one.
    p.moveQueueItem(2, 3);
    expect(p.getQueue().map((e) => e.title)).to.deep.equal([
      "F1",
      "F2",
      "F4",
      "F3",
    ]);
    expect(p.getStatus().track?.title).to.equal("F4");
  });

  it("moveQueueItem shifts the cursor up when a non-playing item moves backward across it", () => {
    const a = artist.create({ name: "BwArtist" }, 63);
    const al = album.create({ title: "BwAlbum", artistName: a.name }, 64);
    const t1 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "B1",
        track: 1,
        duration: 60,
        disc: "1",
      },
      65,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "B2",
        track: 2,
        duration: 60,
        disc: "1",
      },
      66,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "B3",
        track: 3,
        duration: 60,
        disc: "1",
      },
      67,
    );
    track.create(
      {
        artist: a.name,
        album: al.title,
        title: "B4",
        track: 4,
        duration: 60,
        disc: "1",
      },
      68,
    );

    p = new SessionPlayer("S-9", {} as LogService);
    p.playTrack(t1.file); // [B1,B2,B3,B4]
    for (let i = 0; i < 2; i++) p.next(); // now on B3 (index 2)
    expect(p.getStatus().track?.title).to.equal("B3");

    // Move B4 (index 3) backward to index 1, crossing the playing B3: the
    // playing index shifts up one (B3 moves from 2 to 3).
    p.moveQueueItem(3, 1);
    expect(p.getQueue().map((e) => e.title)).to.deep.equal([
      "B1",
      "B4",
      "B2",
      "B3",
    ]);
    expect(p.getStatus().track?.title).to.equal("B3");
  });

  it("empty-queue boundaries are no-ops and a fresh player is stopped", () => {
    p = new SessionPlayer("S-empty", {} as LogService);

    const fresh = p.getStatus();
    expect(fresh.state).to.equal("stop");
    expect(fresh.queueLength).to.equal(0);
    expect(fresh.elapsed).to.equal(0);
    expect(fresh.duration).to.equal(0);
    expect(fresh.track).to.be.undefined;

    let fired = 0;
    p.on("stateChanged", () => fired++);

    p.resume();
    expect(p.state).to.equal("stop");
    p.next();
    expect(p.state).to.equal("stop");
    p.previous();
    expect(p.state).to.equal("stop");
    p.seek(5);
    expect(p.getStatus().elapsed).to.equal(0);

    expect(fired).to.equal(0);
  });

  it("next() past the last track stops the player and emits stateChanged", () => {
    const a = artist.create({ name: "EndArtist" }, 70);
    const al = album.create({ title: "EndAlbum", artistName: a.name }, 71);
    const t1 = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "End",
        track: 1,
        duration: 30,
        disc: "1",
      },
      72,
    );

    p = new SessionPlayer("S-F", {} as LogService);
    p.playTrack(t1.file);

    let fired = 0;
    p.on("stateChanged", () => fired++);

    p.next();
    const s = p.getStatus();
    expect(s.state).to.equal("stop");
    expect(s.queueLength).to.equal(1);
    expect(s.track).to.be.undefined;
    expect(fired).to.equal(1);
  });
});
