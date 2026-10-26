import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { SessionPlayer } from "@services/session/sessionPlayer.js";
import type { LogService } from "@services/utils/logService";

describe("SessionPlayer.playFiles", () => {
  let close: () => void;
  let p: SessionPlayer | undefined;

  beforeEach(() => {
    ({ close } = createTestDb());
  });

  afterEach(() => {
    p?.stop();
    close();
  });

  function seed(title: string, seedNumber: number) {
    const a = artist.create({ name: `FilesArtist${seedNumber}` }, seedNumber);
    const al = album.create(
      { title: `FilesAlbum${seedNumber}`, artistName: a.name },
      seedNumber,
    );
    return track.create(
      {
        artist: a.name,
        album: al.title,
        title,
        file: `${a.name}/${title}.mp3`,
        duration: 30,
      },
      seedNumber,
    );
  }

  it("plays exactly the supplied files and starts at startAt", () => {
    const first = seed("FileA", 101);
    const second = seed("FileB", 102);
    const third = seed("FileC", 103);

    p = new SessionPlayer("files-1", {} as LogService);
    p.playFiles([first.file, second.file, third.file], 1);

    expect(p.getQueue().map((entry) => entry.title)).to.deep.equal([
      "FileA",
      "FileB",
      "FileC",
    ]);
    const status = p.getStatus();
    expect(status.state).to.equal("play");
    expect(status.track?.title).to.equal("FileB");
    expect(status.elapsed).to.equal(0);
    expect(status.queueLength).to.equal(3);
  });

  it("ignores unknown files and stops when nothing is playable", () => {
    p = new SessionPlayer("files-2", {} as LogService);
    p.playFiles(["missing/one.mp3", "missing/two.mp3"]);

    const status = p.getStatus();
    expect(status.state).to.equal("stop");
    expect(status.queueLength).to.equal(0);
    expect(status.track).to.be.undefined;
  });
});
