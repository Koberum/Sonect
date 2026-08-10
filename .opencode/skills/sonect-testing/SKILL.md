---
name: sonect-testing
description: Write, fix, or extend backend tests for the Sonect project. Use this skill whenever the user asks to add tests, fix failing tests, improve test coverage, write a test for a new route/service/controller/WS handler, or asks why a test is broken. The Sonect test setup has specific non-obvious constraints (ESM + esmock + Sinon + Supertest + Mocha) that this skill encodes. Trigger whenever you see files under packages/backend/src/__tests__/ or mentions of Mocha, Sinon, esmock, or Supertest in the context of this project.
---

# Sonect Backend Testing

The test suite lives in `packages/backend/src/__tests__/` and mirrors `src/`:
- `controllers/` — unit tests for controllers
- `services/` — unit tests for services
- `routes/` — integration tests (Express app + Supertest)
- `ws/` — WebSocket handler tests

Run tests with `pnpm backend:test`. Watch mode: `pnpm backend:test:watch`.

---

## Critical constraints

These are the non-obvious things that will break your tests if ignored.

### esmock import — default only

```ts
// CORRECT
import esmock from "esmock";

// WRONG — will throw at runtime
import { esmock } from "esmock";
```

### esmock cannot resolve relative imports in route/service/WS tests

esmock works for controller and service unit tests. But for route tests and WS handler tests (which do dynamic `import()` of the full module chain), esmock's patching doesn't propagate through the tsx loader. Use **Sinon stubs + dynamic `import()`** for those instead (see Route tests section below).

### asyncHandler must return the promise

The `asyncHandler` wrapper in `middleware/asyncHandler.ts` must **return** the promise chain — otherwise Supertest requests hang and tests time out. If you write a new controller and wrap it, make sure `asyncHandler` returns:

```ts
// middleware/asyncHandler.ts — existing, don't change, just know this:
export const asyncHandler = (fn: RequestHandler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next); // returns the promise
```

---

## Service / controller unit tests (esmock)

Use esmock to mock dependencies imported by the module under test.

```ts
import esmock from "esmock";
import sinon from "sinon";
import { expect } from "chai";

describe("PlayerService", () => {
  let playerService: typeof import("../../services/playerService.js");
  let getCachedStatusStub: sinon.SinonStub;

  before(async () => {
    getCachedStatusStub = sinon.stub().returns({ state: "stop", volume: 80 });

    playerService = await esmock("../../services/playerService.js", {
      "../../services/mpdConnectionManager.js": {
        mpdConnectionManager: {
          getCachedStatus: getCachedStatusStub,
          executeCommand: sinon.stub().resolves(),
          refreshNow: sinon.stub().resolves(),
        },
      },
    });
  });

  afterEach(() => sinon.reset());
  after(() => sinon.restore());

  it("returns cached status synchronously", () => {
    const status = playerService.getStatus();
    expect(getCachedStatusStub.calledOnce).to.be.true;
    expect(status.state).to.equal("stop");
  });
});
```

Key points:
- Paths in esmock are **relative to the test file**, ending in `.js` (compiled output convention).
- Mock the entire exported object, not just one function.
- `sinon.reset()` in `afterEach` resets call counts; `sinon.restore()` in `after` removes stubs.

---

## Route tests (Sinon + dynamic import + Supertest)

Because esmock can't patch through the tsx loader for route tests, create stubs before import and verify them after.

```ts
import sinon from "sinon";
import request from "supertest";
import express from "express";
import { expect } from "chai";
import { errorHandler } from "../../middleware/errorHandler.js";

describe("GET /player/status", () => {
  let app: express.Express;
  let getStatusStub: sinon.SinonStub;

  before(async () => {
    // 1. Create stubs
    getStatusStub = sinon.stub().returns({ state: "play", volume: 75 });

    // 2. Build a minimal express app
    app = express();
    app.use(express.json());

    // 3. Dynamic import AFTER stubs exist
    const { playerRouter } = await import("../../routes/player.js");
    app.use("/player", playerRouter);

    // 4. ALWAYS add errorHandler last — controllers throw NotFoundError/ValidationError
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
  let onConnection: (ws: any) => void;
  let mpdManagerStub: any;
  let fakeWs: any;

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
    fakeWs = {
      send: sinon.stub(),
      on: sinon.stub(),
      readyState: 1, // OPEN
    };
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

---

## Error type testing

Controllers throw `NotFoundError` and `ValidationError` from `middleware/errorHandler.ts`. Test them via HTTP response codes:

```ts
it("returns 404 when track not found", async () => {
  getTrackStub.rejects(new NotFoundError("Track not found"));
  const res = await request(app).get("/library/tracks/99999");
  expect(res.status).to.equal(404);
  expect(res.body.error).to.include("not found");
});
```

---

## Zod validation testing

Zod schemas live in `@repo/types/src/schemas.ts` and are called via `schema.parse(req.body)` directly in controllers. A `ZodError` propagates to `errorHandler` which returns 400 with `flatten().fieldErrors`. Test by sending bad payloads:

```ts
it("returns 400 for missing required field", async () => {
  const res = await request(app)
    .post("/player/volume")
    .send({}); // missing `volume` field
  expect(res.status).to.equal(400);
  expect(res.body).to.have.property("fieldErrors");
});

it("returns 400 for out-of-range value", async () => {
  const res = await request(app)
    .post("/player/volume")
    .send({ volume: 150 }); // max is 100
  expect(res.status).to.equal(400);
});
```

---

## Checklist before submitting tests

- [ ] `esmock` imported as default (not named)
- [ ] `errorHandler` added as last middleware in route test apps
- [ ] `.js` extensions on all relative import paths in esmock calls
- [ ] `sinon.restore()` in every `after()` block
- [ ] `pnpm backend:test` passes with zero failures
- [ ] `pnpm lint` passes (no unused imports, no `any` without comments)
