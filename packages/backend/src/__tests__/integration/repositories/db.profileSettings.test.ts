import { expect } from "chai";
import { createTestDb } from "@tests/helpers/db.js";
import { db, profileSettingsDb, profilesDb } from "@repo/db";
import { profileSettings } from "@repo/db";
import { eq } from "drizzle-orm";

describe("profileSettingsDb", () => {
  let close: () => void;
  let profileId: string;

  beforeEach(() => {
    ({ close } = createTestDb());
    profileId = profilesDb.create({
      name: "SettingsOwner",
      passwordHash: "not-used",
      role: "user",
    });
  });

  afterEach(() => close());

  it("defaults to 0 when the profile has no settings row", () => {
    expect(profileSettingsDb.get(profileId)).to.deep.equal({
      crossfadeSeconds: 0,
    });
  });

  it("stores and updates the crossfade per profile", () => {
    expect(profileSettingsDb.setCrossfade(profileId, 5)).to.deep.equal({
      crossfadeSeconds: 5,
    });
    expect(profileSettingsDb.get(profileId).crossfadeSeconds).to.equal(5);

    profileSettingsDb.setCrossfade(profileId, 9);
    expect(profileSettingsDb.get(profileId).crossfadeSeconds).to.equal(9);
  });

  it("clamps out-of-range values", () => {
    profileSettingsDb.setCrossfade(profileId, 99);
    expect(profileSettingsDb.get(profileId).crossfadeSeconds).to.equal(30);

    profileSettingsDb.setCrossfade(profileId, -4);
    expect(profileSettingsDb.get(profileId).crossfadeSeconds).to.equal(0);
  });

  it("cascades when the profile is deleted", () => {
    profileSettingsDb.setCrossfade(profileId, 7);
    profilesDb.delete(profileId);

    const row = db()
      .select()
      .from(profileSettings)
      .where(eq(profileSettings.profile_id, profileId))
      .get();
    expect(row).to.be.undefined;
  });
});
