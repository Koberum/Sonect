import { createHash, randomBytes } from "node:crypto";
import { authSessionsDb, profilesDb } from "@repo/db";
import type { ProfileRole } from "@repo/types";
import { hashPassword } from "@services/auth/password.js";
import { SESSION_TTL_MS } from "@services/auth/constants.js";

let sequence = 0;

export async function createTestSession(
  role: ProfileRole = "admin",
  name = `Test${role}${(sequence += 1)}`,
): Promise<{ id: string; token: string; cookie: string }> {
  const passwordHash = await hashPassword("password123");
  const id = profilesDb.create({ name, passwordHash, role });
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  authSessionsDb.create({
    token_hash: createHash("sha256").update(token).digest("hex"),
    profile_id: id,
    created_at: now,
    expires_at: now + SESSION_TTL_MS,
    last_used_at: now,
  });
  return { id, token, cookie: `sonect_session=${token}` };
}
