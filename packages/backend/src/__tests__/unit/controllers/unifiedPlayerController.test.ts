import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { initializeServices } from "@services/factory.js";
import {
  unifiedSetOutputModeHandler,
  unifiedPauseHandler,
  unifiedAddManyToQueueHandler,
} from "@controllers/unifiedPlayerController.js";
import { resolvePlayerRouter } from "@services/player/playerRouter.js";

describe("unifiedPlayerController.setOutputModeHandler", () => {
  let close: () => void;
  let sandbox: sinon.SinonSandbox;

  before(() => {
    ({ close } = createTestDb());
    initializeServices();
  });

  after(() => close());

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });
  afterEach(() => sandbox.restore());

  it("uses the authenticated session and device headers", async () => {
    const router = resolvePlayerRouter();
    const setMode = sandbox.stub(router, "setMode").resolves({ success: true });
    const header = sandbox.stub().returns("attacker-session");
    const req = {
      body: { mode: "mpd" },
      sessionId: "profile-1",
      deviceId: "device-1",
      deviceName: "Laptop",
      deviceType: "web",
      header,
    } as never;
    const json = sandbox.stub();

    await unifiedSetOutputModeHandler(req, { json } as never, () => undefined);

    expect(
      setMode.calledOnceWith("profile-1", "mpd", "device-1", "Laptop", "web"),
    ).to.be.true;
    expect(header.called).to.be.false;
    expect(json.calledOnceWith({ success: true })).to.be.true;
  });

  it("returns the authoritative playback status after a command", async () => {
    const router = resolvePlayerRouter();
    const engine = { pause: sandbox.stub().resolves() };
    sandbox.stub(router, "forSession").returns(engine as never);
    sandbox.stub(router, "getStatus").returns({
      state: "pause",
      epoch: "epoch-1",
      revision: 7,
    } as never);
    const json = sandbox.stub();

    await unifiedPauseHandler(
      { sessionId: "profile-1" } as never,
      { json } as never,
      () => undefined,
    );

    expect(engine.pause.calledOnce).to.be.true;
    expect(
      json.calledOnceWith({ state: "pause", epoch: "epoch-1", revision: 7 }),
    ).to.be.true;
  });

  it("rejects an invalid mode", async () => {
    let caught: unknown;
    await unifiedSetOutputModeHandler(
      { body: { mode: "invalid" }, sessionId: "profile-1" } as never,
      {} as never,
      (err) => {
        caught = err;
      },
    );

    expect((caught as { name?: string }).name).to.equal("ZodError");
  });

  it("queues files in order and reports partial failures", async () => {
    const router = resolvePlayerRouter();
    const calls: string[] = [];
    const addToQueue = sandbox.stub().callsFake(async (file: string) => {
      calls.push(file);
      if (file === "bad.flac") throw new Error("decode failed");
    });
    sandbox.stub(router, "forSession").returns({ addToQueue } as never);
    sandbox.stub(router, "getMode").returns("browser");
    const status = { state: "stop" };
    sandbox.stub(router, "getStatus").returns(status as never);
    const json = sandbox.stub();
    const setStatus = sandbox.stub().returns({ json });

    await unifiedAddManyToQueueHandler(
      {
        body: { files: ["a.flac", "bad.flac", "b.flac"] },
        sessionId: "profile-1",
      } as never,
      { status: setStatus } as never,
      () => undefined,
    );

    expect(calls).to.deep.equal(["a.flac", "bad.flac", "b.flac"]);
    expect(setStatus.calledOnceWith(200)).to.be.true;
    expect(
      json.calledOnceWith({
        status,
        added: 2,
        failed: [{ file: "bad.flac", error: "decode failed" }],
      }),
    ).to.be.true;
  });

  it("returns 422 when no file could be queued", async () => {
    const router = resolvePlayerRouter();
    sandbox
      .stub(router, "forSession")
      .returns({
        addToQueue: sandbox.stub().rejects(new Error("nope")),
      } as never);
    sandbox.stub(router, "getMode").returns("browser");
    sandbox.stub(router, "getStatus").returns({ state: "stop" } as never);
    const json = sandbox.stub();
    const setStatus = sandbox.stub().returns({ json });

    await unifiedAddManyToQueueHandler(
      { body: { files: ["bad.flac"] }, sessionId: "profile-1" } as never,
      { status: setStatus } as never,
      () => undefined,
    );

    expect(setStatus.calledOnceWith(422)).to.be.true;
    expect(json.firstCall.args[0]).to.deep.include({ added: 0 });
  });
});
