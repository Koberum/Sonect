import { expect } from "chai";
import { EventEmitter } from "events";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { profilesDb, profileSettingsDb } from "@repo/db";
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

describe("PlayerRouter crossfade", () => {
  let close: () => void;
  let registry: SessionRegistry;
  let router: PlayerRouter;
  let manager: FakeMpdManager;
  let profileId: string;
  let owner: string | null;

  beforeEach(() => {
    ({ close } = createTestDb());
    profileId = profilesDb.create({
      name: "CrossfadeOwner",
      passwordHash: "not-used",
      role: "admin",
    });
    profileSettingsDb.setCrossfade(profileId, 4);

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

    const playerService = {
      getPlaybackStatus: () => ({
        state: "stop" as const,
        elapsed: 0,
        duration: 0,
        volume: 100,
        repeat: false,
        random: false,
        single: false,
        consume: false,
        queueLength: 0,
      }),
    } as unknown as PlayerServiceImpl;

    router = new PlayerRouter(
      registry,
      mpdConfig,
      playerService,
      manager as unknown as MpdConnectionManager,
      logService,
    );
  });

  afterEach(() => {
    registry.dispose();
    registryOverrideForTests(null);
    close();
  });

  it("applies the profile crossfade when acquiring MPD", async () => {
    const result = await router.setMode(profileId, "mpd");

    expect(result.success).to.equal(true);
    expect(manager.executeCommand.calledWith("crossfade", ["4"])).to.equal(
      true,
    );
  });

  it("updates MPD when the owner changes the setting and reapplies on reconnect", async () => {
    await router.setMode(profileId, "mpd");
    manager.executeCommand.resetHistory();

    router.setCrossfade(profileId, 9);
    expect(manager.executeCommand.calledWith("crossfade", ["9"])).to.equal(
      true,
    );

    manager.executeCommand.resetHistory();
    router.onMpdConnected();
    expect(manager.executeCommand.calledWith("crossfade", ["9"])).to.equal(
      true,
    );
    expect(router.getStatus(profileId).crossfade).to.equal(9);
  });

  it("does not touch MPD for crossfade changes in browser mode", () => {
    router.setCrossfade(profileId, 6);
    expect(manager.executeCommand.called).to.equal(false);
    expect(router.getStatus(profileId).crossfade).to.equal(6);
  });
});
