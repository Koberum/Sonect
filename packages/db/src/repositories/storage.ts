import { asc, eq, sql, type SQL } from "drizzle-orm";
import type { DBStorageSource } from "@repo/types";
import { db } from "../connection.js";
import { storageSources } from "../tables.js";
import { normalizeRowId } from "./rowId.js";

export const storageDb = {
  getAll(): DBStorageSource[] {
    return db()
      .select()
      .from(storageSources)
      .orderBy(asc(storageSources.name))
      .all() as DBStorageSource[];
  },

  getById(id: number): DBStorageSource | undefined {
    return db()
      .select()
      .from(storageSources)
      .where(eq(storageSources.id, id))
      .get() as DBStorageSource | undefined;
  },

  create(data: {
    name: string;
    type: "smb" | "nfs" | "local";
    uri: string;
    mount_path: string;
    username?: string;
    password?: string;
    enabled?: boolean;
  }): number {
    const result = db()
      .insert(storageSources)
      .values({
        name: data.name,
        type: data.type,
        uri: data.uri,
        mount_path: data.mount_path,
        username: data.username ?? null,
        password: data.password ?? null,
        // `enabled` stays NUMERIC (0/1) at the repository boundary, matching
        // the column type and every read path.
        enabled: data.enabled ? 1 : 0,
      })
      .run();
    return normalizeRowId(result.lastInsertRowid);
  },

  update(
    id: number,
    data: {
      name?: string;
      type?: "smb" | "nfs" | "local";
      uri?: string;
      mount_path?: string;
      username?: string;
      password?: string;
      enabled?: boolean;
    },
  ): void {
    const set: {
      name?: string;
      type?: "smb" | "nfs" | "local";
      uri?: string;
      mount_path?: string;
      username?: string;
      password?: string;
      enabled?: number;
      updated_at?: SQL;
    } = {};
    if (data.name !== undefined) {
      set.name = data.name;
    }
    if (data.type !== undefined) {
      set.type = data.type;
    }
    if (data.uri !== undefined) {
      set.uri = data.uri;
    }
    if (data.mount_path !== undefined) {
      set.mount_path = data.mount_path;
    }
    if (data.username !== undefined) {
      set.username = data.username;
    }
    if (data.password !== undefined) {
      set.password = data.password;
    }
    if (data.enabled !== undefined) {
      set.enabled = data.enabled ? 1 : 0;
    }
    if (Object.keys(set).length === 0) return;
    set.updated_at = sql`CURRENT_TIMESTAMP`;
    db().update(storageSources).set(set).where(eq(storageSources.id, id)).run();
  },

  delete(id: number): void {
    db().delete(storageSources).where(eq(storageSources.id, id)).run();
  },

  updateStats(
    id: number,
    stats: { file_count: number; dir_count: number; total_size: number },
  ): void {
    db()
      .update(storageSources)
      .set({
        file_count: stats.file_count,
        dir_count: stats.dir_count,
        total_size: stats.total_size,
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(storageSources.id, id))
      .run();
  },
};
