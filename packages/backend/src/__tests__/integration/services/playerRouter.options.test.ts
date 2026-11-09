import { expect } from "chai";
import { EventEmitter } from "events";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { profilesDb } from "@repo/db";
import type { PlaybackStatus } from "@repo/types";
import {
  SessionRegistry,
  registryOverrideForTests,
} from "@services/session/sessionRegistry.js";
import { PlayerRouter } from "@services/player/playerRouter.js";
import type { MpdConfigService } from "@services/mpd/mpdConfigService.js";
import type { MpdConnectionManager } from "@services/mpd/mpdConnectionManager.js";
import type { PlayerServiceImpl } from "@services/player/playerService.js";
import type { LogService } from "@services/utils/logService";

class FakeMpdManager extends EventEmitter {
  executeCommand = sinon.stub().resolves("");
}

function status(overrides: Partial<PlaybackStatus> = {}): PlaybackStatus {
  return {
    state: "stop",
    elapsed: 0,
    duration: 0,
    volume: 100,
    repeat: false,
    random: false,
    single: false,
    consume: false,
    repeatMode: "off",
    queueLength: 0,
    ...overrides,
  };
}

describe("PlayerRouter playback options", () => {
  let close: () => void;
  let registry: SessionRegistry;
  let router: PlayerRouter;
  let manager: FakeMpdManager;
  let playerService: {
    getPlaybackStatus: sinon.SinonStub;
    setRandom: sinon.SinonStub;
    setRepeatMode: sinon.SinonStub;
    playTrack: sinon.SinonStub;
    pauseTrack: sinon.SinonStub;
  };
  let profileId: string;
  let owner: string | null;

  beforeEach(() => {
    ({ close } = createTestDb());
    profileId = profilesDb.create({
      name: "OptionsOwner",
      passwordHash: "not-used",
      role: "admin",
    });

    const logService = { pushLog: () => {} } as unknown as LogService;
    registry = new SessionRegistry(logService);
    registryOverrideForTests(registry);
    manager = new FakeMpdManager();
    owner = null;

    const mpdConfig = {
      getMpdOwner: () => owner,
      tryAcquireMpd: (id: string) => {
        if (owner === null || owner === id) {
          owner = id;
          return { success: true };
        }
        return { success: false, owner };
      },
      releaseMpd: (id: string) => {
        if (owner === id) owner = null;
        return true;
      },
      setOutputMode: () => ({ success: true }),
      getOutputDeviceName: () => null,
    } as unknown as MpdConfigService;

    playerService = {
      getPlaybackStatus: sinon.stub().callsFake(() => status()),
      setRandom: sinon.stub().resolves(),
      setRepeatMode: sinon.stub().resolves(),
      playTrack: sinon.stub().resolves(),
      pauseTrack: sinon.stub().resolves(),
    };

    router = new PlayerRouter(
      registry,
      mpdConfig,
      playerService as unknown as PlayerServiceImpl,
      manager as unknown as MpdConnectionManager,
      logService,
    );
  });

  afterEach(() => {
    registry.dispose();
    registryOverrideForTests(null);
    close();
    sinon.restore();
  });

  it("toggles random and repeat in browser mode", async () => {
    await router.setRandom(profileId, true);
    await router.setRepeatMode(profileId, "one");

    const state = router.getStatus(profileId);
    expect(state.random).to.equal(true);
    expect(state.repeat).to.equal(true);
    expect(state.single).to.equal(true);
    expect(state.repeatMode).to.equal("one");
  });

  it("applies browser options when acquiring MPD", async () => {
    await router.setRandom(profileId, true);
    await router.setRepeatMode(profileId, "all");

    await router.setMode(profileId, "mpd");

    expect(playerService.setRandom.calledOnceWith(true)).to.equal(true);
    expect(playerService.setRepeatMode.calledOnceWith("all")).to.equal(true);
    expect(manager.executeCommand.calledWith("consume", ["0"])).to.equal(true);
  });

  it("reapplies the owner options after an MPD reconnect", async () => {
    await router.setRandom(profileId, true);
    await router.setRepeatMode(profileId, "one");
    await router.setMode(profileId, "mpd");
    playerService.setRandom.resetHistory();
    playerService.setRepeatMode.resetHistory();
    manager.executeCommand.resetHistory();

    router.onMpdConnected();

    expect(playerService.setRandom.calledWith(true)).to.equal(true);
    expect(playerService.setRepeatMode.calledWith("one")).to.equal(true);
    expect(manager.executeCommand.calledWith("consume", ["0"])).to.equal(true);
  });
});
