import { expect } from "chai";
import sinon from "sinon";
import { PlayerServiceImpl } from "@services/player/playerService.js";
import type { MpdConnectionManager } from "@services/mpd/mpdConnectionManager.js";
import type { LogService } from "@services/utils/logService.js";
import type { AutoplayService } from "@services/mpd/autoplayService.js";

describe("PlayerServiceImpl queue commands", () => {
  afterEach(() => sinon.restore());

  function makeService() {
    const executeCommand = sinon.stub().resolves("");
    const executeCommandList = sinon.stub().resolves("");
    const refreshNow = sinon.stub().resolves();
    const manager = {
      executeCommand,
      executeCommandList,
      refreshNow,
      getCachedStatus: () => ({ repeat: false }),
    } as unknown as MpdConnectionManager;
    const service = new PlayerServiceImpl(
      {} as LogService,
      manager,
      {} as AutoplayService,
    );
    return { service, executeCommand, executeCommandList, refreshNow };
  }

  it("moveInQueue sends the MPD move command", async () => {
    const { service, executeCommand, refreshNow } = makeService();

    await service.moveInQueue(2, 0);

    expect(executeCommand.calledOnceWithExactly("move", ["2", "0"])).to.equal(
      true,
    );
    expect(refreshNow.calledOnce).to.equal(true);
  });

  it("clearQueue sends the MPD clear command", async () => {
    const { service, executeCommand, refreshNow } = makeService();

    await service.clearQueue();

    expect(executeCommand.calledOnceWithExactly("clear")).to.equal(true);
    expect(refreshNow.calledOnce).to.equal(true);
  });

  it("maps repeat modes to the repeat and single commands", async () => {
    const { service, executeCommandList, refreshNow } = makeService();

    await service.setRepeatMode("all");
    expect(executeCommandList.firstCall.args[0]).to.deep.equal([
      { command: "repeat", args: ["1"] },
      { command: "single", args: ["0"] },
    ]);

    await service.setRepeatMode("one");
    expect(executeCommandList.secondCall.args[0]).to.deep.equal([
      { command: "repeat", args: ["1"] },
      { command: "single", args: ["1"] },
    ]);

    await service.setRepeatMode("off");
    expect(executeCommandList.thirdCall.args[0]).to.deep.equal([
      { command: "repeat", args: ["0"] },
      { command: "single", args: ["0"] },
    ]);
    expect(refreshNow.callCount).to.equal(3);
  });

  it("sends the MPD random command", async () => {
    const { service, executeCommand, refreshNow } = makeService();

    await service.setRandom(true);

    expect(executeCommand.calledOnceWithExactly("random", ["1"])).to.equal(
      true,
    );
    expect(refreshNow.calledOnce).to.equal(true);
  });
});
