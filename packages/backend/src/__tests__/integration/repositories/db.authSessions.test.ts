import { expect } from "chai";
import { authSessionsDb, profilesDb } from "@repo/db";
import { createTestDb } from "@tests/helpers/db.js";

describe("auth sessions repository", () => {
  let close: () => void;

  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("stores, finds, and expires sessions", () => {
    const profileId = profilesDb.create({
      name: "SessionUser",
      passwordHash: "hash",
      role: "admin",
    });
    const now = 1_000;
    authSessionsDb.create({
      token_hash: "token-hash",
      profile_id: profileId,
      created_at: now,
      expires_at: now + 500,
      last_used_at: now,
      user_agent: "test",
      device_id: "device",
    });

    expect(authSessionsDb.findValid("token-hash", now)?.profile_id).to.equal(
      profileId,
    );
    expect(authSessionsDb.findValid("token-hash", now + 501)).to.equal(
      undefined,
    );
  });

  it("counts only active sessions for a profile", () => {
    const profileId = profilesDb.create({
      name: "ActiveSessions",
      passwordHash: "hash",
    });
    const otherProfileId = profilesDb.create({
      name: "OtherSessions",
      passwordHash: "hash",
    });
    authSessionsDb.create({
      token_hash: "active",
      profile_id: profileId,
      created_at: 0,
      expires_at: 2_000,
      last_used_at: 0,
    });
    authSessionsDb.create({
      token_hash: "expired",
      profile_id: profileId,
      created_at: 0,
      expires_at: 500,
      last_used_at: 0,
    });
    authSessionsDb.create({
      token_hash: "other-active",
      profile_id: otherProfileId,
      created_at: 0,
      expires_at: 2_000,
      last_used_at: 0,
    });

    expect(authSessionsDb.countByProfile(profileId)).to.equal(2);
    expect(authSessionsDb.countActiveByProfile(profileId, 1_000)).to.equal(1);
    expect(authSessionsDb.countActiveByProfile(profileId, 2_000)).to.equal(0);
  });

  it("cascades sessions when a profile is deleted", () => {
    const profileId = profilesDb.create({
      name: "DeleteMe",
      passwordHash: "hash",
    });
    authSessionsDb.create({
      token_hash: "t",
      profile_id: profileId,
      created_at: 0,
      expires_at: 10_000,
      last_used_at: 0,
    });

    profilesDb.delete(profileId);
    expect(authSessionsDb.countByProfile(profileId)).to.equal(0);
  });

  it("keeps one session when deleting other sessions", () => {
    const profileId = profilesDb.create({
      name: "MultiDevice",
      passwordHash: "hash",
    });
    for (const hash of ["keep", "drop"]) {
      authSessionsDb.create({
        token_hash: hash,
        profile_id: profileId,
        created_at: 0,
        expires_at: 10_000,
        last_used_at: 0,
      });
    }

    authSessionsDb.deleteOtherSessions(profileId, "keep");
    expect(authSessionsDb.getByTokenHash("keep")).to.exist;
    expect(authSessionsDb.getByTokenHash("drop")).to.equal(undefined);
  });
});
