import { eq } from "drizzle-orm";
import { db } from "../connection.js";
import { syncMetadata } from "../tables.js";

export const syncMetadataDb = {
  get(key: string): string | undefined {
    const row = db()
      .select({ value: syncMetadata.value })
      .from(syncMetadata)
      .where(eq(syncMetadata.key, key))
      .get();
    return row?.value ?? undefined;
  },
};
