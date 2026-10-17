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

## Test data: use the factories (which use the production write path)

`__tests__/factories/` seed real rows through the same functions production uses: `track.create()` calls `upsertTrack(db(), …)`, `artist.create()` calls `findOrCreateArtist(db(), …)`, etc. (`tracksDb.upsert`, `artistsDb.findOrCreate`, `albumsDb.findOrCreate`, `genresDb.findOrCreate` no longer exist.)

```ts
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";

const a = artist.create({ name: "ArtistA" }, 1);
const al = album.create({ title: "AlbumA", artistName: a.name }, 1);
const t = track.create({ artist: a.name, album: al.title, title: "T1" }, 2);
```

Seeds take `(overrides, seed)`; the seed makes faker deterministic.

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

Route modules are **default exports** (`catalogRoutes.ts`, `unifiedPlayerRoutes.ts`, …). Build a minimal Express app with a local `makeApp()` helper, add `errorHandler` last, and import the router dynamically after any stubs are set up:

```ts
import sinon from "sinon";
import request from "supertest";
import express from "express";
import { expect } from "chai";
import { errorHandler } from "@middleware/errorHandler.js";

describe("GET /catalog/artists", () => {
  let app: express.Express;

  function makeApp(routes: express.Router) {
    const app = express();
    app.use(express.json());
    app.use("/catalog", routes);
    app.use(errorHandler); // ALWAYS last — controllers throw NotFound/ValidationError
    return app;
  }

  before(async () => {
    const { default: catalogRoutes } = await import("@routes/catalogRoutes.js");
    app = makeApp(catalogRoutes);
  });

  after(() => sinon.restore());

  it("returns 200 with artists", async () => {
    const res = await request(app).get("/catalog/artists");
    expect(res.status).to.equal(200);
  });
});
```

Key points:

- Always add `errorHandler` as the last middleware — without it, thrown `NotFoundError`/`ValidationError` crash the test instead of returning the right HTTP status.
- Dynamic `import()` is cached after first load, so build the app once in `before()` (or per-test via `makeApp()` when you need fresh state).
- Routes under `/player` require the `X-Session-Id` header (`middleware/sessionId.ts` → 400 without it); send `.set("X-Session-Id", "test")` when hitting them.

---

## WebSocket handler tests

`player.ws.ts` exports `setupPlayerWebSocket(wss)` (one argument). Integration tests build a real HTTP server + `WebSocketServer` on an ephemeral port:

```ts
import { expect } from "chai";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupPlayerWebSocket } from "../../../ws/player.ws.js";

describe("player WS", () => {
  let server: ReturnType<typeof createServer>;
  let wss: WebSocketServer;
  let baseUrl: string;

  beforeEach((done) => {
    server = createServer();
    wss = new WebSocketServer({ server });
    setupPlayerWebSocket(wss);
    server.listen(0, () => {
      baseUrl = `ws://localhost:${(server.address() as { port: number }).port}/ws`;
      done();
    });
  });

  afterEach(() => {
    wss.close();
    server.close();
  });

  it("sends player-status on connect", (done) => {
    const ws = new WebSocket(`${baseUrl}?sessionId=abc`);
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as Record<string, unknown>;
      expect(msg.type).to.equal("player-status");
      ws.close();
      done();
    });
  });
});
```

There is no `@ws/*` alias — import WS modules with a relative path (e.g. `../../ws/player.ws.js`). Session-scoped WS tests override the global registry with `registryOverrideForTests()` (see `integration/ws/sessionWs.test.ts`).

---

## Error type testing

Controllers throw `NotFoundError`, `ValidationError`, `ConflictError` and `LockedError` from `middleware/errorHandler.ts`. Test them via HTTP response codes:

```ts
it("returns 404 when the album does not exist", async () => {
  const res = await request(app).get("/catalog/albums/99999");
  expect(res.status).to.equal(404);
});
```

---

## Zod validation testing

Zod schemas live in the grouped objects in `@repo/types` and are parsed directly in controllers (`schema.parse(req.body)` / `schema.parse(req.params)`). A `ZodError` propagates to `errorHandler`, which returns 400 with `{ error, details: flatten().fieldErrors }`:

```ts
it("returns 400 for missing required field", async () => {
  const res = await request(app)
    .post("/system/storage/sources")
    .send({ path: "/libraries/x" }); // missing `name`
  expect(res.status).to.equal(400);
  expect(res.body.details.fieldErrors).to.have.property("name");
});
```

---

## Checklist before submitting tests

- [ ] No `esmock` usage — use DI or Sinon stubs instead
- [ ] `errorHandler` added as last middleware in route test apps
- [ ] Imports use the `@services`/`@controllers`/`@tests` aliases (`.js` extension)
- [ ] `sandbox.restore()` / `sinon.restore()` in every cleanup block
- [ ] Test data seeded via `@tests/factories/*` (they use the production write path)
- [ ] `pnpm backend:test` passes with zero failures
- [ ] `pnpm lint` passes (no unused imports, no `any` without comments)
