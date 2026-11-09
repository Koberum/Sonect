import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { PlayerServiceImpl } from "@services/player/playerService.js";
import type { LogService } from "@services/utils/logService";
import type { AutoplayService } from "@services/mpd/autoplayService";

describe("PlayerServiceImpl.playTrack", () => {
  let close: () => void;

  beforeEach(() => {
    ({ close } = createTestDb());
  });

  afterEach(() => {
    close();
    sinon.restore();
  });

  function seedAlbum(name: string, seed: number) {
    const a = artist.create({ name }, seed);
    const al = album.create(
      { title: `${name}Album`, artistName: a.name },
      seed,
    );
    const first = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "A",
        file: `${name}/A.mp3`,
        duration: 20,
        track: 1,
        disc: "1",
      },
      seed + 1,
    );
    const second = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "B",
        file: `${name}/B.mp3`,
        duration: 20,
        track: 2,
        disc: "1",
      },
      seed + 2,
    );
    return { first, second };
  }

  function makeService(repeat: boolean, extraFile?: string) {
    const executeCommandList = sinon.stub().resolves("");
    const refreshNow = sinon.stub().resolves();
    const autoplay = {
      resetSession: sinon.stub().returns(3),
      getNextBatch: sinon.stub().returns(extraFile ? [extraFile] : []),
      commitBatch: sinon.stub(),
      sessionId: 3,
    };
    const manager = {
      executeCommandList,
      refreshNow,
      getCachedStatus: () => ({ repeat }),
    };
    const service = new PlayerServiceImpl(
      {} as LogService,
      manager as never,
      autoplay as unknown as AutoplayService,
    );
    return { service, executeCommandList, autoplay };
  }

  it("clears, adds the album slice, and disables consume", async () => {
    const { first, second } = seedAlbum("PlayTrack", 800);
    const { service, executeCommandList } = makeService(false);

    await service.playTrack(first.file);

    expect(executeCommandList.firstCall.args[0]).to.deep.equal([
      { command: "clear" },
      { command: "add", args: [first.file] },
      { command: "add", args: [second.file] },
      { command: "consume", args: ["0"] },
      { command: "play", args: ["0"] },
    ]);
  });

  it("skips the autoplay batch when repeat is active", async () => {
    const { first } = seedAlbum("RepeatMpd", 810);
    const a = artist.create({ name: "RepeatExtra" }, 820);
    const al = album.create(
      { title: "RepeatExtraAlbum", artistName: a.name },
      820,
    );
    const extra = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "Extra",
        file: "RepeatExtra/Extra.mp3",
        duration: 20,
      },
      821,
    );
    const { service, autoplay } = makeService(true, extra.file);

    await service.playTrack(first.file);

    expect(autoplay.getNextBatch.called).to.equal(false);
    expect(autoplay.commitBatch.called).to.equal(false);
  });

  it("appends the autoplay batch when repeat is off", async () => {
    const { first } = seedAlbum("AutoplayMpd", 830);
    const a = artist.create({ name: "AutoplayExtra" }, 840);
    const al = album.create(
      { title: "AutoplayExtraAlbum", artistName: a.name },
      840,
    );
    const extra = track.create(
      {
        artist: a.name,
        album: al.title,
        title: "Extra",
        file: "AutoplayExtra/Extra.mp3",
        duration: 20,
      },
      841,
    );
    const { service, executeCommandList, autoplay } = makeService(
      false,
      extra.file,
    );

    await service.playTrack(first.file);

    expect(autoplay.getNextBatch.calledOnce).to.equal(true);
    expect(autoplay.commitBatch.calledOnce).to.equal(true);
    expect(executeCommandList.callCount).to.equal(2);
    expect(executeCommandList.secondCall.args[0]).to.deep.equal([
      { command: "add", args: [extra.file] },
    ]);
  });
});
