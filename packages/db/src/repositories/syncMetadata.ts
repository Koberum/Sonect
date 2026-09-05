import { eq, sql } from "drizzle-orm";
import { db } from "../connection.js";
import { syncMetadata } from "../tables.js";

export const syncMetadataDb = {
  set(key: string, value: string): void {
    db()
      .insert(syncMetadata)
      .values({ key, value, updated_at: sql`CURRENT_TIMESTAMP` })
      .onConflictDoUpdate({
        target: syncMetadata.key,
        set: { value, updated_at: sql`CURRENT_TIMESTAMP` },
      })
      .run();
  },

  get(key: string): string | undefined {
    const row = db()
      .select({ value: syncMetadata.value })
      .from(syncMetadata)
      .where(eq(syncMetadata.key, key))
      .get();
    return row?.value ?? undefined;
  },

  getLastSync(): Date | undefined {
    const result = syncMetadataDb.get("last_sync");
    return result ? new Date(result) : undefined;
  },

  setLastSync(): void {
    syncMetadataDb.set("last_sync", new Date().toISOString());
  },
};
