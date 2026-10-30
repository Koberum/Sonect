import { and, eq, gt, lt, ne, sql } from "drizzle-orm";
import { db } from "../connection.js";
import { authSessions } from "../tables.js";

export type DBAuthSession = {
  token_hash: string;
  profile_id: string;
  created_at: number;
  expires_at: number;
  last_used_at: number;
  user_agent?: string | null;
  device_id?: string | null;
};

export const authSessionsDb = {
  create(row: DBAuthSession): void {
    db().insert(authSessions).values(row).run();
  },

  findValid(tokenHash: string, now: number): DBAuthSession | undefined {
    return db()
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.token_hash, tokenHash),
          gt(authSessions.expires_at, now),
        ),
      )
      .get() as DBAuthSession | undefined;
  },

  getByTokenHash(tokenHash: string): DBAuthSession | undefined {
    return db()
      .select()
      .from(authSessions)
      .where(eq(authSessions.token_hash, tokenHash))
      .get() as DBAuthSession | undefined;
  },

  touch(tokenHash: string, now: number): void {
    db()
      .update(authSessions)
      .set({ last_used_at: now })
      .where(eq(authSessions.token_hash, tokenHash))
      .run();
  },

  delete(tokenHash: string): void {
    db()
      .delete(authSessions)
      .where(eq(authSessions.token_hash, tokenHash))
      .run();
  },

  deleteByProfile(profileId: string): void {
    db()
      .delete(authSessions)
      .where(eq(authSessions.profile_id, profileId))
      .run();
  },

  deleteOtherSessions(profileId: string, keepTokenHash: string): void {
    db()
      .delete(authSessions)
      .where(
        and(
          eq(authSessions.profile_id, profileId),
          ne(authSessions.token_hash, keepTokenHash),
        ),
      )
      .run();
  },

  countByProfile(profileId: string): number {
    const row = db()
      .select({ n: sql<number>`count(*)` })
      .from(authSessions)
      .where(eq(authSessions.profile_id, profileId))
      .get();
    return row?.n ?? 0;
  },

  countActiveByProfile(profileId: string, now: number): number {
    const row = db()
      .select({ n: sql<number>`count(*)` })
      .from(authSessions)
      .where(
        and(
          eq(authSessions.profile_id, profileId),
          gt(authSessions.expires_at, now),
        ),
      )
      .get();
    return row?.n ?? 0;
  },

  deleteExpired(now: number): void {
    db().delete(authSessions).where(lt(authSessions.expires_at, now)).run();
  },
};
