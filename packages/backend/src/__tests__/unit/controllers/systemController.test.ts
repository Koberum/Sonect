import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { getMpdConfigService, initializeServices } from "@services/factory.js";
import { setOutputModeHandler } from "@controllers/systemController.js";
import { UnauthorizedError } from "@middleware/errorHandler.js";

describe("systemController.setOutputModeHandler", () => {
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

  it("uses the authenticated profile id instead of X-Session-Id", async () => {
    const svc = getMpdConfigService();
    const acquire = sandbox
      .stub(svc, "tryAcquireMpd")
      .returns({ success: true });
    sandbox.stub(svc, "setOutputMode").returns({ success: true });
    const header = sandbox.stub().returns("attacker-session");
    const req = {
      body: { mode: "mpd" },
      auth: { profileId: "profile-1", tokenHash: "hash" },
      header,
    } as never;
    const json = sandbox.stub();
    const res = { json } as never;
    const next: Parameters<typeof setOutputModeHandler>[2] = () => undefined;

    await setOutputModeHandler(req, res, next);

    expect(acquire.calledOnceWith("profile-1")).to.be.true;
    expect(header.called).to.be.false;
    expect(json.calledOnceWith({ success: true })).to.be.true;
  });

  it("rejects an unauthenticated request", async () => {
    let caught: unknown;
    const next = (err: unknown) => {
      caught = err;
    };

    await setOutputModeHandler(
      { body: { mode: "browser" }, header: sandbox.stub() } as never,
      {} as never,
      next,
    );

    expect(caught).to.be.instanceOf(UnauthorizedError);
  });
});
