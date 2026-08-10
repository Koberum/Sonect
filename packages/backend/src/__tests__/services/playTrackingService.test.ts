import { expect } from "chai";
import sinon from "sinon";
import { EventEmitter } from "events";

describe("play tracking service", () => {
  let PlayTrackingService: any;
  let emitter: EventEmitter;
  let incrementPlayCount: sinon.SinonStub;
  let updateLastPlayed: sinon.SinonStub;
  let clock: sinon.SinonFakeTimers | null;

  before(async () => {
    incrementPlayCount = sinon.stub();
    updateLastPlayed = sinon.stub();

    const mod = await import("esmock").then((esmock) =>
      esmock.default("../../services/playTrackingService.ts", {
        "@repo/db": {
          tracksDb: { incrementPlayCount },
          albumsDb: { updateLastPlayed },
        },
      }),
    );
    PlayTrackingService = mod.PlayTrackingService;
  });

  beforeEach(() => {
    clock = null;
    emitter = new EventEmitter();
  });

  afterEach(() => {
    if (clock) clock.restore();
    sinon.reset();
  });

  after(() => {
    sinon.restore();
  });

  it("calls incrementPlayCount and updateLastPlayed on trackChanged", () => {
    const service = new PlayTrackingService(emitter);
    service.start();

    emitter.emit("trackChanged", { id: 42, album_id: 7 });

    sinon.assert.calledOnceWithExactly(incrementPlayCount, 42);
    sinon.assert.calledOnceWithExactly(updateLastPlayed, 7);
  });

  it("does not call updateLastPlayed when album_id is null", () => {
    const service = new PlayTrackingService(emitter);
    service.start();

    emitter.emit("trackChanged", { id: 42, album_id: null });

    sinon.assert.calledOnceWithExactly(incrementPlayCount, 42);
    sinon.assert.notCalled(updateLastPlayed);
  });

  it("debounces rapid duplicate track changes", () => {
    const service = new PlayTrackingService(emitter);
    service.start();

    emitter.emit("trackChanged", { id: 42, album_id: 7 });
    emitter.emit("trackChanged", { id: 42, album_id: 7 });

    sinon.assert.calledOnce(incrementPlayCount);
  });

  it("allows different track after debounce window", () => {
    clock = sinon.useFakeTimers();
    clock.tick(6000);
    const service = new PlayTrackingService(emitter);
    service.start();

    emitter.emit("trackChanged", { id: 42, album_id: 7 });
    clock.tick(6000);
    emitter.emit("trackChanged", { id: 99, album_id: 3 });

    sinon.assert.calledTwice(incrementPlayCount);
    sinon.assert.calledWith(incrementPlayCount.firstCall, 42);
    sinon.assert.calledWith(incrementPlayCount.secondCall, 99);
    sinon.assert.calledTwice(updateLastPlayed);
  });

  it("blocks different tracks within debounce window", () => {
    clock = sinon.useFakeTimers();
    clock.tick(6000);
    const service = new PlayTrackingService(emitter);
    service.start();

    emitter.emit("trackChanged", { id: 42, album_id: 7 });
    emitter.emit("trackChanged", { id: 99, album_id: 3 });

    sinon.assert.calledOnce(incrementPlayCount);
    sinon.assert.calledWith(incrementPlayCount, 42);
    sinon.assert.calledOnce(updateLastPlayed);
    sinon.assert.calledWith(updateLastPlayed, 7);
  });

  it("stops listening after stop() is called", () => {
    const service = new PlayTrackingService(emitter);
    service.start();
    service.stop();

    emitter.emit("trackChanged", { id: 42, album_id: 7 });

    sinon.assert.notCalled(incrementPlayCount);
    sinon.assert.notCalled(updateLastPlayed);
  });
});
