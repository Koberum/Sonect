import { expect } from "chai";
import express from "express";
import request from "supertest";
import playerRoutes from "@routes/unifiedPlayerRoutes";
import { authenticate } from "@middleware/auth";
import { errorHandler } from "@middleware/errorHandler";
import { createTestDb } from "@tests/helpers/db.js";
import { createTestSession } from "@tests/helpers/auth.js";
import { profileSettingsDb } from "@repo/db";
import {
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use("/player", playerRoutes);
  app.use(errorHandler);
  return app;
}

describe("player playback settings routes", () => {
  let close: () => void;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });

  beforeEach(() => {
    ({ close } = createTestDb());
  });

  afterEach(() => close());

  it("requires authentication", async () => {
    const res = await request(makeApp()).get("/player/settings");
    expect(res.status).to.equal(401);
  });

  it("returns the current profile's default crossfade", async () => {
    const { cookie } = await createTestSession("admin", "SettingsAdmin");
    const res = await request(makeApp())
      .get("/player/settings")
      .set("Cookie", cookie);
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({ crossfadeSeconds: 0 });
  });

  it("forbids non-admin writes", async () => {
    const { cookie } = await createTestSession("user", "SettingsUser");
    const res = await request(makeApp())
      .put("/player/settings")
      .set("Cookie", cookie)
      .send({ crossfadeSeconds: 5 });
    expect(res.status).to.equal(403);
  });

  it("persists an admin crossfade and exposes it in player-status", async () => {
    const { id, cookie } = await createTestSession("admin", "SettingsAdmin2");
    const app = makeApp();

    const saved = await request(app)
      .put("/player/settings")
      .set("Cookie", cookie)
      .send({ crossfadeSeconds: 7 });
    expect(saved.status).to.equal(200);
    expect(saved.body).to.deep.equal({ crossfadeSeconds: 7 });
    expect(profileSettingsDb.get(id).crossfadeSeconds).to.equal(7);

    const read = await request(app)
      .get("/player/settings")
      .set("Cookie", cookie);
    expect(read.status).to.equal(200);
    expect(read.body).to.deep.equal({ crossfadeSeconds: 7 });

    const status = await request(app)
      .get("/player/status")
      .set("Cookie", cookie);
    expect(status.status).to.equal(200);
    expect(status.body.crossfade).to.equal(7);
  });

  it("rejects out-of-range or non-integer values", async () => {
    const { cookie } = await createTestSession("admin", "SettingsAdmin3");
    const app = makeApp();

    const tooHigh = await request(app)
      .put("/player/settings")
      .set("Cookie", cookie)
      .send({ crossfadeSeconds: 31 });
    expect(tooHigh.status).to.equal(400);

    const negative = await request(app)
      .put("/player/settings")
      .set("Cookie", cookie)
      .send({ crossfadeSeconds: -1 });
    expect(negative.status).to.equal(400);

    const fractional = await request(app)
      .put("/player/settings")
      .set("Cookie", cookie)
      .send({ crossfadeSeconds: 1.5 });
    expect(fractional.status).to.equal(400);
  });
});
