import { expect } from "chai";
import express from "express";
import request from "supertest";
import profileRoutes from "@routes/profileRoutes";
import { authenticate } from "@middleware/auth";
import { errorHandler } from "@middleware/errorHandler";
import { createTestDb } from "@tests/helpers/db.js";
import { createTestSession } from "@tests/helpers/auth.js";
import { profilesDb, authSessionsDb } from "@repo/db";
import {
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use("/profiles", profileRoutes);
  app.use(errorHandler);
  return app;
}

describe("admin profile routes", () => {
  let close: () => void;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("forbids user profile management", async () => {
    const { cookie } = await createTestSession("user", "PlainUser");
    const res = await request(makeApp()).get("/profiles").set("Cookie", cookie);
    expect(res.status).to.equal(403);
  });

  it("creates a user profile with a password and role", async () => {
    const { cookie } = await createTestSession("admin", "Admin");
    const created = await request(makeApp())
      .post("/profiles")
      .set("Cookie", cookie)
      .send({
        name: "Listener",
        password: "password123",
        role: "user",
      });
    expect(created.status).to.equal(201);
    expect(created.body.role).to.equal("user");
    expect(created.body.password_hash).to.equal(undefined);
    expect(profilesDb.getById(created.body.id)?.password_hash).to.be.a(
      "string",
    );
  });

  it("cannot delete or demote the last admin", async () => {
    const { id, cookie } = await createTestSession("admin", "OnlyAdmin");
    const app = makeApp();

    const demote = await request(app)
      .patch(`/profiles/${id}`)
      .set("Cookie", cookie)
      .send({ role: "user" });
    expect(demote.status).to.equal(409);

    const remove = await request(app)
      .delete(`/profiles/${id}`)
      .set("Cookie", cookie);
    expect(remove.status).to.equal(409);
  });

  it("resets a profile password and invalidates its sessions", async () => {
    const { cookie } = await createTestSession("admin", "Admin");
    const target = await createTestSession("user", "Target");
    const before = profilesDb.getById(target.id)?.password_hash;
    expect(authSessionsDb.countByProfile(target.id)).to.equal(1);

    const res = await request(makeApp())
      .post(`/profiles/${target.id}/password`)
      .set("Cookie", cookie)
      .send({ password: "newpassword123" });
    expect(res.status).to.equal(204);
    expect(authSessionsDb.countByProfile(target.id)).to.equal(0);
    const after = profilesDb.getById(target.id)?.password_hash;
    expect(after).to.be.a("string");
    expect(after).to.not.equal(before);
  });
});
