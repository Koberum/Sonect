import { expect } from "chai";
import { LastAdminError, profilesDb } from "@repo/db";
import { createTestDb } from "@tests/helpers/db.js";

describe("profiles repository (auth fields)", () => {
  let close: () => void;

  beforeEach(() => {
    ({ close } = createTestDb());
  });
  afterEach(() => close());

  it("creates admin and user profiles with hashes and roles", () => {
    const adminId = profilesDb.create({
      name: "Admin",
      passwordHash: "hash-admin",
      role: "admin",
    });
    const userId = profilesDb.create({
      name: "User",
      passwordHash: "hash-user",
    });

    expect(profilesDb.getById(adminId)).to.include({
      name: "Admin",
      role: "admin",
      password_hash: "hash-admin",
    });
    expect(profilesDb.getById(userId)).to.include({
      name: "User",
      role: "user",
      password_hash: "hash-user",
    });
    expect(profilesDb.countAdmins()).to.equal(1);
  });

  it("prevents demoting or deleting the last admin", () => {
    const adminId = profilesDb.create({
      name: "OnlyAdmin",
      passwordHash: "hash",
      role: "admin",
    });

    expect(() => profilesDb.setRole(adminId, "user")).to.throw(LastAdminError);
    expect(() => profilesDb.delete(adminId)).to.throw(LastAdminError);
  });

  it("allows demoting an admin when another admin exists", () => {
    const first = profilesDb.create({
      name: "FirstAdmin",
      passwordHash: "hash",
      role: "admin",
    });
    profilesDb.create({
      name: "SecondAdmin",
      passwordHash: "hash",
      role: "admin",
    });

    profilesDb.setRole(first, "user");
    expect(profilesDb.getById(first)?.role).to.equal("user");
    expect(profilesDb.countAdmins()).to.equal(1);
  });

  it("applies name, color and role in one update", () => {
    const id = profilesDb.create({ name: "Before", passwordHash: "hash" });

    profilesDb.update(id, {
      name: "After",
      avatarColor: "#123456",
      role: "admin",
    });

    expect(profilesDb.getById(id)).to.include({
      name: "After",
      avatar_color: "#123456",
      role: "admin",
    });
  });

  it("rolls back name/color when demoting the last admin fails", () => {
    const adminId = profilesDb.create({
      name: "OnlyAdmin",
      passwordHash: "hash",
      role: "admin",
    });
    const originalColor = profilesDb.getById(adminId)?.avatar_color;

    expect(() =>
      profilesDb.update(adminId, {
        name: "Renamed",
        avatarColor: "#123456",
        role: "user",
      }),
    ).to.throw(LastAdminError);

    const persisted = profilesDb.getById(adminId);
    expect(persisted?.name).to.equal("OnlyAdmin");
    expect(persisted?.avatar_color).to.equal(originalColor);
    expect(persisted?.role).to.equal("admin");
  });

  it("rolls back name/color/role when the new name already exists", () => {
    profilesDb.create({ name: "Taken", passwordHash: "hash" });
    const id = profilesDb.create({ name: "Target", passwordHash: "hash" });
    const originalColor = profilesDb.getById(id)?.avatar_color;

    expect(() =>
      profilesDb.update(id, {
        name: "Taken",
        avatarColor: "#123456",
        role: "admin",
      }),
    ).to.throw();

    const persisted = profilesDb.getById(id);
    expect(persisted?.name).to.equal("Target");
    expect(persisted?.avatar_color).to.equal(originalColor);
    expect(persisted?.role).to.equal("user");
  });

  it("updates password hashes", () => {
    const id = profilesDb.create({ name: "P", passwordHash: "old" });
    profilesDb.setPassword(id, "new");
    expect(profilesDb.getById(id)?.password_hash).to.equal("new");
    expect(profilesDb.getById(id)?.password_updated_at).to.be.a("number");
  });
});
