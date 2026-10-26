import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { PlayerServiceImpl } from "@services/player/playerService.js";
import type { LogService } from "@services/utils/logService";
import type { AutoplayService } from "@services/mpd/autoplayService";

describe("PlayerServiceImpl.playFiles", () => {
  let close: () => void;
  let mpd: {
    executeCommandList: sinon.SinonStub;
    refreshNow: sinon.SinonStub;
  };
  let autoplay: {
    resetSession: sinon.SinonStub;
    getNextBatch: sinon.SinonStub;
    commitBatch: sinon.SinonStub;
    sessionId: number;
  };

  beforeEach(() => {
    ({ close } = createTestDb());
    mpd = {
      executeCommandList: sinon.stub().resolves(""),
      refreshNow: sinon.stub().resolves(),
    };
    autoplay = {
      resetSession: sinon.stub().returns(7),
      getNextBatch: sinon.stub().returns([]),
      commitBatch: sinon.stub(),
      sessionId: 7,
    };
  });

  afterEach(() => {
    close();
    sinon.restore();
  });

  function seed(title: string, seedNumber: number) {
    const a = artist.create({ name: `MpdArtist${seedNumber}` }, seedNumber);
    const al = album.create(
      { title: `MpdAlbum${seedNumber}`, artistName: a.name },
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

  it("clears the MPD queue, adds the files, and starts at startAt", async () => {
    const first = seed("MpdA", 201);
    const second = seed("MpdB", 202);
    const svc = new PlayerServiceImpl(
      {} as LogService,
      mpd as never,
      autoplay as unknown as AutoplayService,
    );

    await svc.playFiles([first.file, second.file], 1);

    expect(mpd.executeCommandList.calledOnce).to.be.true;
    expect(mpd.executeCommandList.firstCall.args[0]).to.deep.equal([
      { command: "clear" },
      { command: "add", args: [first.file] },
      { command: "add", args: [second.file] },
      { command: "consume", args: ["0"] },
      { command: "play", args: ["1"] },
    ]);
    expect(
      autoplay.resetSession.calledOnceWith(second.file, [
        first.file,
        second.file,
      ]),
    ).to.be.true;
  });

  it("does nothing when no supplied file exists", async () => {
    const svc = new PlayerServiceImpl(
      {} as LogService,
      mpd as never,
      autoplay as unknown as AutoplayService,
    );

    await svc.playFiles(["missing/a.mp3"]);

    expect(mpd.executeCommandList.called).to.be.false;
  });
});
