---
name: sonect-testing
description: Write, fix, or extend backend tests for the Sonect project. Use this skill whenever the user asks to add tests, fix failing tests, improve test coverage, write a test for a new route/service/controller/WS handler, or asks why a test is broken. The Sonect test setup has specific non-obvious constraints (ESM + Sinon + Supertest + Mocha) that this skill encodes. Trigger whenever you see files under packages/backend/src/__tests__/ or mentions of Mocha, Sinon, or Supertest in the context of this project.
---

# Sonect Backend Testing

The test suite lives in `packages/backend/src/__tests__/` and mirrors `src/`:

- `unit/controllers/`, `unit/services/` — pure/unit tests using constructor/factory **DI** or Sinon stubs on real instances
- `integration/services/`, `integration/repositories/` (`db.*` + tracks), `integration/routes/`, `integration/ws/` — service/repo/route/ws integration (real `:memory:` DB via `helpers/db.ts`)
- `e2e/` — full-stack `app` + `supertest`

Run tests with `pnpm backend:test`. Watch mode: `pnpm backend:test:watch`.

---

## Critical constraints

These are the non-obvious things that will break your tests if ignored.

### ESM module mocking is not used

`esmock` was removed from this project. ESM module mocking cannot patch through the `tsx` loader for route/service/WS modules, so the suite relies on:

- **Constructor/factory DI** — inject collaborators as constructor arguments (see `NetworkServiceImpl`).
- **Sinon stubs on real instances** — initialize the real services via `@services/factory.js` and stub object methods with a sandbox.
- **Sinon stubs + dynamic `import()`** — set up stubs first, then import the module under test (see Route tests).

Never introduce `esmock` (the dependency is gone).

### asyncHandler must return the promise

The `asyncHandler` wrapper in `middleware/asyncHandler.ts` must **return** the promise chain — otherwise Supertest requests hang and tests time out. If you write a new controller and wrap it, make sure `asyncHandler` returns:

```ts
// middleware/asyncHandler.ts — existing, don't change, just know this:
export const asyncHandler =
  (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next); // returns the promise
```

### Import aliases

Tests import through the tsconfig path aliases (with the `.js` extension convention), not deep relative paths:

- `@services/*`, `@controllers/*`, `@routes/*`, `@middleware/*`, `@tests/*`

```ts
import { NetworkServiceImpl } from "@services/network/networkService.js";
import { createTestDb } from "@tests/helpers/db.js";
```

---

## Service / controller unit tests (DI or Sinon on real instances)

**Constructor DI** — inject collaborators directly (preferred for services with a clear dependency boundary):

```ts
import { expect } from "chai";
import sinon from "sinon";
import { NetworkServiceImpl } from "@services/network/networkService.js";

describe("NetworkService (unit, DI)", () => {
  it("returns dnsReachable true when lookup resolves", async () => {
    const osStub = {
      networkInterfaces: () => ({
        eth0: [{ family: "IPv4", internal: false, address: "192.168.1.10" }],
      }),
    } as unknown as typeof import("node:os");
    const lookup = (() =>
      Promise.resolve({ address: "93.184.216.34", family: 4 })) as never;

    const service = new NetworkServiceImpl(osStub, lookup);
    expect(await service.getNetworkStatus()).to.deep.equal({
      connected: true,
      dnsReachable: true,
    });
  });
});
```

**Sinon sandbox on a real instance** — for controllers that call a factory-provided singleton service, initialize the real in-memory DB + factory, then `sandbox.stub(instance, "method")`:

```ts
import { expect } from "chai";
import sinon from "sinon";
import { createTestDb } from "@tests/helpers/db.js";
import { initializeServices, getCatalogService } from "@services/factory.js";
import { getArtistById } from "@controllers/catalogController.js";

describe("catalogController (stubbed service)", () => {
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

  it("forwards NotFoundError when service returns null", async () => {
    sandbox.stub(getCatalogService(), "getArtistById").returns(null as never);
    let caught: unknown;
    await getArtistById(
      { params: { id: "999" } } as never,
      {} as never,
      (err) => {
        caught = err;
      },
    );
    expect(String(caught)).to.match(/Artist|NotFound/);
  });
});
```

Key points:

- `sinon.createSandbox()` + `sandbox.restore()` in `afterEach` keeps stubs isolated per test.
- Stub the whole returned object / the method you exercise, not just a nested function.

---

## Route tests (Sinon + dynamic import + Supertest)

Set up stubs before importing the router, then verify them after.

```ts
import sinon from "sinon";
import request from "supertest";
import express from "express";
import { expect } from "chai";
import { errorHandler } from "@middleware/errorHandler.js";

describe("GET /player/status", () => {
  let app: express.Express;

  before(async () => {
    app = express();
    app.use(express.json());

    // Dynamic import AFTER stubs exist
    const { playerRouter } = await import("@routes/player.js");
    app.use("/player", playerRouter);

    // ALWAYS add errorHandler last — controllers throw NotFoundError/ValidationError
    app.use(errorHandler);
  });

  after(() => sinon.restore());

  it("returns 200 with playback status", async () => {
    const res = await request(app).get("/player/status");
    expect(res.status).to.equal(200);
    expect(res.body).to.have.property("state");
  });

  it("returns 404 for unknown resource", async () => {
    const res = await request(app).get("/player/nonexistent");
    expect(res.status).to.equal(404);
  });
});
```

Key points:

- Always add `errorHandler` as the last middleware — without it, thrown `NotFoundError`/`ValidationError` crash the test instead of returning the right HTTP status.
- Build the app in `before()`, not `beforeEach()` — dynamic `import()` is cached after first load.

---

## WebSocket handler tests

```ts
import sinon from "sinon";
import { expect } from "chai";

describe("player.ws.ts", () => {
  let onConnection: (ws: unknown) => void;
  let mpdManagerStub: Record<string, unknown>;
  let fakeWs: {
    send: sinon.SinonStub;
    on: sinon.SinonStub;
    readyState: number;
  };

  before(async () => {
    mpdManagerStub = {
      getCachedStatus: sinon.stub().returns({ state: "play" }),
      on: sinon.stub(),
      off: sinon.stub(),
    };

    const { createPlayerWsHandler } = await import("../../ws/player.ws.js");
    onConnection = createPlayerWsHandler(mpdManagerStub);
  });

  beforeEach(() => {
    fakeWs = { send: sinon.stub(), on: sinon.stub(), readyState: 1 };
  });

  afterEach(() => sinon.reset());
  after(() => sinon.restore());

  it("sends cached status on connect", () => {
    onConnection(fakeWs);
    expect(fakeWs.send.calledOnce).to.be.true;
    const payload = JSON.parse(fakeWs.send.firstCall.args[0]);
    expect(payload.state).to.equal("play");
  });
});
```

There is no `@ws/*` alias — import WS modules with a relative path (e.g. `../../ws/player.ws.js`) from tests under `src/__tests__/`.

---

## Error type testing

Controllers throw `NotFoundError` and `ValidationError` from `middleware/errorHandler.ts`. Test them via HTTP response codes:

```ts
it("returns 404 when track not found", async () => {
  const res = await request(app).get("/library/tracks/99999");
  expect(res.status).to.equal(404);
  expect(res.body.error).to.include("not found");
});
```

---

## Zod validation testing

Zod schemas live in `@repo/types` and are called via `schema.parse(req.body)` / `schema.parse(req.params)` directly in controllers. A `ZodError` propagates to `errorHandler` which returns 400 with `flatten().fieldErrors`. Test by sending bad payloads:

```ts
it("returns 400 for missing required field", async () => {
  const res = await request(app).post("/player/volume").send({}); // missing `volume`
  expect(res.status).to.equal(400);
  expect(res.body).to.have.property("fieldErrors");
});

it("returns 400 for out-of-range value", async () => {
  const res = await request(app).post("/player/volume").send({ volume: 150 }); // max is 100
  expect(res.status).to.equal(400);
});
```

---

## Checklist before submitting tests

- [ ] No `esmock` usage — use DI or Sinon stubs instead
- [ ] `errorHandler` added as last middleware in route test apps
- [ ] Imports use the `@services`/`@controllers`/`@tests` aliases (`.js` extension)
- [ ] `sandbox.restore()` / `sinon.restore()` in every cleanup block
- [ ] `pnpm backend:test` passes with zero failures
- [ ] `pnpm lint` passes (no unused imports, no `any` without comments)
