import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { initializeServices, getCatalogService } from "@services/factory.js";
import { getArtists, getArtistById } from "@controllers/libraryController.js";

// Layer 3: Controller unit test — service is stubbed, no DB
// Note: we initialize a real in-memory DB so factory/services exist,
// then stub the service instance methods (sinon can stub object methods).
describe("libraryController (controller unit, stubbed service)", () => {
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

  it("getArtists returns {items, total} from service", async () => {
    const fakeArtists = [{ id: 1, name: "A" }];
    const svc = getCatalogService();
    sandbox.stub(svc, "getAllArtists").returns(fakeArtists as never);
    sandbox.stub(svc, "getArtistCount").returns(1 as never);

    const req = { query: {} } as never;
    const res = { json: sandbox.stub() } as never;
    const next = sandbox.stub();

    await getArtists(req, res, next);
    expect((svc.getAllArtists as sinon.SinonStub).calledOnce).to.be.true;
    expect(
      (
        (res as unknown as { json: sinon.SinonStub }).json as sinon.SinonStub
      ).calledOnceWith({ items: fakeArtists, total: 1 }),
    ).to.be.true;
    expect(next.called).to.be.false;
  });

  it("getArtistById forwards NotFoundError when service returns null", async () => {
    const svc = getCatalogService();
    sandbox.stub(svc, "getArtistById").returns(null as never);
    const req = { params: { id: "999" } } as never;
    const res = {} as never;
    let caught: unknown;
    const next = (err: unknown) => {
      caught = err;
    };

    await getArtistById(req, res, next);
    expect(String(caught)).to.match(/Artist|NotFound/);
  });

  it("returns 400 when id param is invalid (Zod)", async () => {
    const req = { params: { id: "not-a-number" } } as never;
    const res = {} as never;
    let caught: unknown;
    const next = (err: unknown) => {
      caught = err;
    };

    await getArtistById(req, res, next);
    expect(caught).to.exist;
    expect((caught as { name?: string }).name).to.equal("ZodError");
  });
});
