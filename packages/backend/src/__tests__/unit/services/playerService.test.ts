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
    const refreshNow = sinon.stub().resolves();
    const manager = {
      executeCommand,
      refreshNow,
    } as unknown as MpdConnectionManager;
    const service = new PlayerServiceImpl(
      {} as LogService,
      manager,
      {} as AutoplayService,
    );
    return { service, executeCommand, refreshNow };
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
});
