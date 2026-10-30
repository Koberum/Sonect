import { expect } from "chai";
import { authSessionsDb, profilesDb } from "@repo/db";
import { createTestDb } from "@tests/helpers/db.js";
import { AuthServiceImpl } from "@services/auth/authService.js";
import { hashPassword, verifyPassword } from "@services/auth/password.js";
import {
  generateSessionToken,
  hashSessionToken,
} from "@services/auth/tokens.js";
import {
  ConflictError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@middleware/errorHandler.js";

async function expectReject(
  promise: Promise<unknown>,
  errorClass: new (...args: never[]) => Error,
): Promise<void> {
  try {
    await promise;
    throw new Error("Expected promise to reject");
  } catch (err) {
    expect(err).to.be.instanceOf(errorClass);
  }
}

describe("AuthService", () => {
  let close: () => void;

  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("bootstraps exactly one admin and authenticates it", async () => {
    const service = new AuthServiceImpl();
    const { token, profile } = await service.bootstrap({
      name: "Admin",
      password: "password123",
    });

    expect(profile.role).to.equal("admin");
    expect(service.getState(token).authenticated).to.equal(true);
    expect(service.getState(token).profile?.name).to.equal("Admin");
    await expectReject(
      service.bootstrap({ name: "Other", password: "password123" }),
      ConflictError,
    );
  });

  it("logs in, rejects a wrong password, and throttles after five failures", async () => {
    const service = new AuthServiceImpl();
    const { profile } = await service.bootstrap({
      name: "Admin",
      password: "password123",
    });

    const login = await service.login(profile.id, "password123");
    expect(login.profile.id).to.equal(profile.id);

    for (let i = 0; i < 5; i += 1) {
      await expectReject(
        service.login(profile.id, "wrong-password"),
        UnauthorizedError,
      );
    }
    await expectReject(
      service.login(profile.id, "password123"),
      TooManyRequestsError,
    );
  });

  it("switches profile only with the destination password", async () => {
    const service = new AuthServiceImpl();
    const admin = await service.bootstrap({
      name: "Admin",
      password: "password123",
    });
    const secondId = profilesDb.create({
      name: "SecondAdmin",
      passwordHash: await hashPassword("password123"),
      role: "admin",
    });

    const switched = await service.switchProfile(
      admin.token,
      secondId,
      "password123",
    );
    expect(switched.result.profile.id).to.equal(secondId);
    expect(switched.previousProfileId).to.equal(admin.profile.id);
  });

  it("allows only one concurrent bootstrap to create an admin", async () => {
    const service = new AuthServiceImpl();
    const [first, second] = await Promise.allSettled([
      service.bootstrap({ name: "AdminA", password: "password123" }),
      service.bootstrap({ name: "AdminB", password: "password123" }),
    ]);

    const outcomes = [first, second];
    expect(outcomes.filter((r) => r.status === "fulfilled")).to.have.length(1);
    const rejected = outcomes.find(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(rejected?.reason).to.be.instanceOf(ConflictError);
    expect(profilesDb.countAdmins()).to.equal(1);
  });

  it("rejects switching from an expired session", async () => {
    const service = new AuthServiceImpl();
    const admin = await service.bootstrap({
      name: "Admin",
      password: "password123",
    });
    const targetId = profilesDb.create({
      name: "TargetAdmin",
      passwordHash: await hashPassword("target-password"),
      role: "admin",
    });

    const expiredToken = generateSessionToken();
    const past = Date.now() - 60_000;
    authSessionsDb.create({
      token_hash: hashSessionToken(expiredToken),
      profile_id: admin.profile.id,
      created_at: past,
      expires_at: past,
      last_used_at: past,
      user_agent: null,
      device_id: null,
    });

    await expectReject(
      service.switchProfile(expiredToken, targetId, "target-password"),
      UnauthorizedError,
    );
  });

  it("does not count expired sessions as remaining after logout", async () => {
    const now = 10_000;
    const service = new AuthServiceImpl(undefined, () => now);
    const admin = await service.bootstrap({
      name: "Admin",
      password: "password123",
    });
    authSessionsDb.create({
      token_hash: "expired-logout",
      profile_id: admin.profile.id,
      created_at: 0,
      expires_at: now - 1,
      last_used_at: 0,
    });

    const result = service.logout(admin.token);

    expect(result?.remainingSessions).to.equal(0);
  });

  it("does not count expired sessions as remaining after switching", async () => {
    const now = 10_000;
    const service = new AuthServiceImpl(undefined, () => now);
    const admin = await service.bootstrap({
      name: "Admin",
      password: "password123",
    });
    const targetId = profilesDb.create({
      name: "TargetUser",
      passwordHash: await hashPassword("target-password"),
    });
    authSessionsDb.create({
      token_hash: "expired-switch",
      profile_id: admin.profile.id,
      created_at: 0,
      expires_at: now - 1,
      last_used_at: 0,
    });

    const switched = await service.switchProfile(
      admin.token,
      targetId,
      "target-password",
    );

    expect(switched.previousRemainingSessions).to.equal(0);
  });

  it("rejects a wrong current password without changing the hash", async () => {
    const service = new AuthServiceImpl();
    const { token, profile } = await service.bootstrap({
      name: "Admin",
      password: "password123",
    });
    const before = profilesDb.getById(profile.id)?.password_hash;

    await expectReject(
      service.changePassword(
        profile.id,
        hashSessionToken(token),
        "wrong-password",
        "newpassword123",
      ),
      UnauthorizedError,
    );

    expect(profilesDb.getById(profile.id)?.password_hash).to.equal(before);
  });

  it("changes the password, keeps the current session, and deletes others", async () => {
    const service = new AuthServiceImpl();
    const { token, profile } = await service.bootstrap({
      name: "Admin",
      password: "password123",
    });
    const other = await service.login(profile.id, "password123");
    const before = profilesDb.getById(profile.id)?.password_hash;

    await service.changePassword(
      profile.id,
      hashSessionToken(token),
      "password123",
      "newpassword123",
    );

    const after = profilesDb.getById(profile.id)?.password_hash;
    expect(after).to.not.equal(before);
    expect(after).to.be.a("string");
    if (!after) throw new Error("Expected a new password hash");
    expect(await verifyPassword("newpassword123", after)).to.equal(true);
    expect(service.validateSession(token)).to.not.equal(null);
    expect(service.validateSession(other.token)).to.equal(null);
  });

  it("reset password invalidates every session", async () => {
    const service = new AuthServiceImpl();
    const { profile } = await service.bootstrap({
      name: "Admin",
      password: "password123",
    });
    await service.resetPassword(profile.id, "newpassword123");
    expect(authSessionsDb.countByProfile(profile.id)).to.equal(0);
  });
});
