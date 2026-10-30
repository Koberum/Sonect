import { asc, eq, sql } from "drizzle-orm";
import type { DBProfile, ProfileRole } from "@repo/types";
import { db, transaction } from "../connection.js";
import { profiles } from "../tables.js";

export class LastAdminError extends Error {}

export const AVATAR_COLORS = [
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#eab308",
  "#ef4444",
] as const;

export function pickAvatarColor(name: string): string {
  let hash = 2166136261;
  for (const character of name) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export const profilesDb = {
  getAll(): DBProfile[] {
    return db()
      .select()
      .from(profiles)
      .orderBy(asc(profiles.created_at))
      .all() as DBProfile[];
  },

  getById(id: string): DBProfile | undefined {
    return db().select().from(profiles).where(eq(profiles.id, id)).get() as
      DBProfile | undefined;
  },

  count(): number {
    const row = db()
      .select({ n: sql<number>`count(*)` })
      .from(profiles)
      .get();
    return row?.n ?? 0;
  },

  countAdmins(): number {
    const row = db()
      .select({ n: sql<number>`count(*)` })
      .from(profiles)
      .where(eq(profiles.role, "admin"))
      .get();
    return row?.n ?? 0;
  },

  create(input: {
    name: string;
    avatarColor?: string;
    passwordHash: string;
    role?: ProfileRole;
  }): string {
    const trimmed = input.name.trim();
    const id = crypto.randomUUID();
    db()
      .insert(profiles)
      .values({
        id,
        name: trimmed,
        avatar_color: input.avatarColor ?? pickAvatarColor(trimmed),
        password_hash: input.passwordHash,
        role: input.role ?? "user",
        password_updated_at: Date.now(),
        created_at: Date.now(),
      })
      .run();
    return id;
  },

  rename(id: string, name: string): void {
    db()
      .update(profiles)
      .set({ name: name.trim() })
      .where(eq(profiles.id, id))
      .run();
  },

  setColor(id: string, color: string): void {
    db()
      .update(profiles)
      .set({ avatar_color: color })
      .where(eq(profiles.id, id))
      .run();
  },

  /**
   * Applies name/avatarColor/role changes in a single transaction so a rejected
   * role change (or a name conflict) leaves every field untouched.
   */
  update(
    id: string,
    data: { name?: string; avatarColor?: string; role?: ProfileRole },
  ): void {
    transaction((tx) => {
      const target = tx
        .select()
        .from(profiles)
        .where(eq(profiles.id, id))
        .get() as DBProfile | undefined;
      if (!target) return;
      if (
        data.role !== undefined &&
        target.role === "admin" &&
        data.role !== "admin"
      ) {
        const row = tx
          .select({ n: sql<number>`count(*)` })
          .from(profiles)
          .where(eq(profiles.role, "admin"))
          .get();
        if ((row?.n ?? 0) <= 1) {
          throw new LastAdminError("Cannot demote the last administrator");
        }
      }

      const changes: {
        name?: string;
        avatar_color?: string;
        role?: ProfileRole;
      } = {};
      if (data.name !== undefined) changes.name = data.name.trim();
      if (data.avatarColor !== undefined)
        changes.avatar_color = data.avatarColor;
      if (data.role !== undefined) changes.role = data.role;
      if (Object.keys(changes).length === 0) return;

      tx.update(profiles).set(changes).where(eq(profiles.id, id)).run();
    });
  },

  setRole(id: string, role: ProfileRole): void {
    transaction((tx) => {
      const target = tx
        .select()
        .from(profiles)
        .where(eq(profiles.id, id))
        .get() as DBProfile | undefined;
      if (!target) return;
      if (target.role === "admin" && role !== "admin") {
        const row = tx
          .select({ n: sql<number>`count(*)` })
          .from(profiles)
          .where(eq(profiles.role, "admin"))
          .get();
        if ((row?.n ?? 0) <= 1) {
          throw new LastAdminError("Cannot demote the last administrator");
        }
      }
      tx.update(profiles).set({ role }).where(eq(profiles.id, id)).run();
    });
  },

  setPassword(id: string, passwordHash: string): void {
    db()
      .update(profiles)
      .set({ password_hash: passwordHash, password_updated_at: Date.now() })
      .where(eq(profiles.id, id))
      .run();
  },

  delete(id: string): void {
    transaction((tx) => {
      const target = tx
        .select()
        .from(profiles)
        .where(eq(profiles.id, id))
        .get() as DBProfile | undefined;
      if (!target) return;
      if (target.role === "admin") {
        const row = tx
          .select({ n: sql<number>`count(*)` })
          .from(profiles)
          .where(eq(profiles.role, "admin"))
          .get();
        if ((row?.n ?? 0) <= 1) {
          throw new LastAdminError("Cannot delete the last administrator");
        }
      }
      tx.delete(profiles).where(eq(profiles.id, id)).run();
    });
  },
};
