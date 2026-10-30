import { expect } from "chai";
import express from "express";
import request from "supertest";
import catalogRoutes from "@routes/catalogRoutes";
import systemRoutes from "@routes/systemRoutes";
import { authenticate } from "@middleware/auth";
import { errorHandler } from "@middleware/errorHandler";
import { createTestDb } from "@tests/helpers/db.js";
import { createTestSession } from "@tests/helpers/auth.js";
import {
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use("/catalog", catalogRoutes);
  app.use("/system", systemRoutes);
  app.use(errorHandler);
  return app;
}

describe("auth guards", () => {
  let close: () => void;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("rejects unauthenticated catalog access", async () => {
    const res = await request(makeApp()).get("/catalog/artists");
    expect(res.status).to.equal(401);
  });

  it("allows authenticated catalog access", async () => {
    const { cookie } = await createTestSession("user", "CatalogUser");
    const res = await request(makeApp())
      .get("/catalog/artists")
      .set("Cookie", cookie);
    expect(res.status).to.equal(200);
  });

  it("rejects user access to admin routes", async () => {
    const { cookie } = await createTestSession("user", "NormalUser");
    const res = await request(makeApp())
      .get("/system/storage/sources")
      .set("Cookie", cookie);
    expect(res.status).to.equal(403);
  });

  it("keeps health public", async () => {
    const res = await request(makeApp()).get("/system/health");
    expect(res.status).to.equal(200);
  });
});
