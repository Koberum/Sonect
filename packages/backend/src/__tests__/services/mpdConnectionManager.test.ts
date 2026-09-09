import { expect } from "chai";
import sinon from "sinon";
import { MpdConnectionManager } from "../../services/utils/mpdConnectionManager";

describe("MpdConnectionManager autoplay refill", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("refills a low non-empty queue without requiring an autoplay flag", async () => {
    const manager = new MpdConnectionManager();
    // The refill decision lives inside the private poll cycle; exercise it without a TCP socket.
    const internals = manager as any;
    const refill = sinon.stub().resolves();
    manager.setAutoplayCallback(refill);
    internals._pollConnected = true;
    internals.pollSocket = {};
    internals._lastSongId = 1;
    internals._cache = {
      state: "play",
      elapsed: 0,
      duration: 120,
      volume: 50,
      repeat: false,
      random: false,
      single: false,
      consume: true,
      queueLength: 5,
      track: { id: 1, file: "current.mp3", title: "Current" },
    };
    sinon
      .stub(internals, "executeOnPollClient")
      .resolves("state: play\nsongid: 1\nplaylistlength: 4");

    await internals.refreshFullCache();

    expect(refill.calledOnceWithExactly("current.mp3")).to.be.true;
  });

  it("uses the number of tracks remaining after the current position", async () => {
    const manager = new MpdConnectionManager();
    // The refill decision lives inside the private poll cycle; exercise it without a TCP socket.
    const internals = manager as any;
    const refill = sinon.stub().resolves();
    manager.setAutoplayCallback(refill);
    internals._pollConnected = true;
    internals.pollSocket = {};
    internals._lastSongId = 1;
    internals._cache = {
      state: "play",
      track: { id: 1, file: "current.mp3", title: "Current" },
    };
    sinon
      .stub(internals, "executeOnPollClient")
      .resolves("state: play\nsongid: 1\nsong: 10\nplaylistlength: 14");

    await internals.refreshFullCache();

    expect(refill.calledOnceWithExactly("current.mp3")).to.be.true;
  });

  it("does not start another refill while one is still running", async () => {
    const clock = sinon.useFakeTimers({ now: 20_000 });
    const manager = new MpdConnectionManager();
    // The refill decision lives inside the private poll cycle; exercise it without a TCP socket.
    const internals = manager as any;
    let finishRefill: (() => void) | undefined;
    const refill = sinon.stub().returns(
      new Promise<void>((resolve) => {
        finishRefill = resolve;
      }),
    );
    manager.setAutoplayCallback(refill);
    internals._pollConnected = true;
    internals.pollSocket = {};
    internals._lastSongId = 1;
    internals._cache = {
      state: "play",
      track: { id: 1, file: "current.mp3", title: "Current" },
    };
    sinon
      .stub(internals, "executeOnPollClient")
      .resolves("state: play\nsongid: 1\nplaylistlength: 4");

    await internals.refreshFullCache();
    await clock.tickAsync(10_001);
    await internals.refreshFullCache();

    expect(refill.calledOnce).to.be.true;
    finishRefill?.();
    await Promise.resolve();
    clock.restore();
  });
});
