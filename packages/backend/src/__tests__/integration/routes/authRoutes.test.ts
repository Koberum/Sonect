import { expect } from "chai";
import express from "express";
import request from "supertest";
import authRoutes from "@routes/authRoutes";
import { authenticate } from "@middleware/auth";
import { errorHandler } from "@middleware/errorHandler";
import { createTestDb } from "@tests/helpers/db.js";
import { profilesDb } from "@repo/db";
import {
  initializeServices,
  isServicesInitialized,
} from "@services/factory.js";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(authenticate);
  app.use("/auth", authRoutes);
  app.use(errorHandler);
  return app;
}

describe("auth routes", () => {
  let close: () => void;

  before(() => {
    if (!isServicesInitialized()) initializeServices();
  });
  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("reports bootstrapRequired on a fresh database", async () => {
    const res = await request(makeApp()).get("/auth/state");
    expect(res.status).to.equal(200);
    expect(res.body).to.deep.equal({
      bootstrapRequired: true,
      authenticated: false,
      profile: null,
    });
  });

  it("bootstraps an admin, sets a cookie, and logs in", async () => {
    const app = makeApp();
    const bootstrap = await request(app)
      .post("/auth/bootstrap")
      .send({ name: "Admin", password: "password123" });

    expect(bootstrap.status).to.equal(201);
    expect(bootstrap.body.profile.role).to.equal("admin");
    const cookie = bootstrap.headers["set-cookie"]?.[0];
    expect(cookie).to.contain("sonect_session=");

    const profiles = await request(app)
      .get("/auth/profiles")
      .set("Cookie", cookie);
    expect(profiles.body).to.deep.equal([
      {
        id: bootstrap.body.profile.id,
        name: "Admin",
        avatarColor: bootstrap.body.profile.avatarColor,
      },
    ]);

    const state = await request(app).get("/auth/state").set("Cookie", cookie);
    expect(state.body.authenticated).to.equal(true);

    const logout = await request(app)
      .post("/auth/logout")
      .set("Cookie", cookie);
    expect(logout.status).to.equal(204);
  });

  it("rejects a wrong password and a second bootstrap", async () => {
    const app = makeApp();
    const bootstrap = await request(app)
      .post("/auth/bootstrap")
      .send({ name: "Admin", password: "password123" });
    const profileId = bootstrap.body.profile.id as string;

    const wrong = await request(app)
      .post("/auth/login")
      .send({ profileId, password: "wrong-password" });
    expect(wrong.status).to.equal(401);

    const again = await request(app)
      .post("/auth/bootstrap")
      .send({ name: "Other", password: "password123" });
    expect(again.status).to.equal(409);

    const profiles = profilesDb.getAll();
    expect(profiles).to.have.length(1);
  });

  it("changes the password and revokes the profile's other sessions", async () => {
    const app = makeApp();
    const bootstrap = await request(app)
      .post("/auth/bootstrap")
      .send({ name: "Admin", password: "password123" });
    const profileId = bootstrap.body.profile.id as string;
    const currentCookie = bootstrap.headers["set-cookie"][0] as string;

    const secondLogin = await request(app)
      .post("/auth/login")
      .send({ profileId, password: "password123" });
    const otherCookie = secondLogin.headers["set-cookie"][0] as string;

    const wrong = await request(app)
      .post("/auth/password")
      .set("Cookie", currentCookie)
      .send({
        currentPassword: "wrong-password",
        newPassword: "newpassword123",
      });
    expect(wrong.status).to.equal(401);

    const changed = await request(app)
      .post("/auth/password")
      .set("Cookie", currentCookie)
      .send({ currentPassword: "password123", newPassword: "newpassword123" });
    expect(changed.status).to.equal(204);

    const currentState = await request(app)
      .get("/auth/state")
      .set("Cookie", currentCookie);
    expect(currentState.body.authenticated).to.equal(true);

    const otherState = await request(app)
      .get("/auth/state")
      .set("Cookie", otherCookie);
    expect(otherState.body.authenticated).to.equal(false);

    const relogin = await request(app)
      .post("/auth/login")
      .send({ profileId, password: "newpassword123" });
    expect(relogin.status).to.equal(200);
  });

  it("switches account only with the destination password", async () => {
    const app = makeApp();
    const admin = await request(app)
      .post("/auth/bootstrap")
      .send({ name: "Admin", password: "password123" });
    const adminCookie = admin.headers["set-cookie"][0];
    const userId = profilesDb.create({
      name: "User",
      passwordHash: await (
        await import("@services/auth/password.js")
      ).hashPassword("userpassword"),
    });

    const bad = await request(app)
      .post("/auth/switch")
      .set("Cookie", adminCookie)
      .send({ profileId: userId, password: "wrong" });
    expect(bad.status).to.equal(401);

    const ok = await request(app)
      .post("/auth/switch")
      .set("Cookie", adminCookie)
      .send({ profileId: userId, password: "userpassword" });
    expect(ok.status).to.equal(200);
    expect(ok.body.profile.id).to.equal(userId);
  });
});
