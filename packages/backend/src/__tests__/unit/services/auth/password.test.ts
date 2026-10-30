import { randomBytes, scryptSync } from "node:crypto";
import { expect } from "chai";
import { hashPassword, verifyPassword } from "@services/auth/password.js";

function makeStoredHash(
  digest: Buffer,
  params: { n: number; r?: number; p?: number },
): string {
  return `scrypt$${params.n}$${params.r ?? 8}$${params.p ?? 1}$saltsaltsaltsalt$${digest.toString("base64url")}`;
}

describe("password hashing", () => {
  it("verifies the correct password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).to.match(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("correct horse battery", hash)).to.equal(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("secret123");
    expect(await verifyPassword("secret124", hash)).to.equal(false);
  });

  it("rejects malformed hashes", async () => {
    expect(await verifyPassword("secret123", "not-a-hash")).to.equal(false);
  });

  it("rejects N=0 without throwing", async () => {
    const stored = makeStoredHash(randomBytes(64), { n: 0 });
    expect(await verifyPassword("secret123", stored)).to.equal(false);
  });

  it("rejects non-power-of-two N without throwing", async () => {
    const stored = makeStoredHash(randomBytes(64), { n: 15_000 });
    expect(await verifyPassword("secret123", stored)).to.equal(false);
  });

  it("rejects digest lengths outside the allowed range", async () => {
    const salt = "bounds-test-salt";
    for (const keyLength of [15, 129]) {
      const digest = scryptSync("secret123", salt, keyLength, {
        N: 16_384,
        r: 8,
        p: 1,
      });
      const stored = `scrypt$16384$8$1$${salt}$${digest.toString("base64url")}`;
      expect(await verifyPassword("secret123", stored)).to.equal(false);
    }
  });

  it("returns false when scrypt rejects otherwise bounded parameters", async () => {
    const stored = makeStoredHash(randomBytes(64), { n: 2 ** 20, r: 32 });
    expect(await verifyPassword("secret123", stored)).to.equal(false);
  });
});
