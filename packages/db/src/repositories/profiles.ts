import { asc, eq, sql } from "drizzle-orm";
import type { DBProfile } from "@repo/types";
import { db, transaction } from "../connection.js";
import { profiles } from "../tables.js";

export class LastProfileError extends Error {}

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

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
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

  create(name: string, avatarColor?: string): string {
    const trimmed = name.trim();
    const id = crypto.randomUUID();
    const color = avatarColor ?? pickAvatarColor(trimmed);
    db()
      .insert(profiles)
      .values({
        id,
        name: trimmed,
        avatar_color: color,
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

  delete(id: string): void {
    transaction((tx) => {
      const row = tx
        .select({ n: sql<number>`count(*)` })
        .from(profiles)
        .get();
      if ((row?.n ?? 0) <= 1) {
        throw new LastProfileError("Cannot delete the last remaining profile");
      }
      tx.delete(profiles).where(eq(profiles.id, id)).run();
    });
  },

  ensureDefault(): void {
    const row = db()
      .select({ n: sql<number>`count(*)` })
      .from(profiles)
      .get();
    if ((row?.n ?? 0) > 0) return;
    db()
      .insert(profiles)
      .values({
        id: crypto.randomUUID(),
        name: "default",
        avatar_color: "#f97316",
        created_at: Date.now(),
      })
      .run();
  },
};
