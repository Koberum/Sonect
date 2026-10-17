import { eq, sql } from "drizzle-orm";
import type { MPDTrack } from "@repo/types";
import { transaction, type DatabaseTransaction } from "../connection.js";
import { syncMetadata, tracks as tracksTable } from "../tables.js";
import { upsertTrack } from "./tracks.js";
import { syncMetadataDb } from "./syncMetadata.js";

export type LibraryIncrementalResult = {
  synced: number;
  deleted: number;
  errors: number;
};

// Current on-disk scanner format. The presence of the `scanner_version`
// marker tells LibraryScanner whether a scan is the first run (and so must
// clean up legacy/unattributed rows conservatively). See buildDeletions().
const SCANNER_VERSION = "1";

// Upsert-on-conflict stamp for the sync_metadata key/value table.
function stampMetadata(
  executor: DatabaseTransaction,
  key: string,
  value: string,
): void {
  executor
    .insert(syncMetadata)
    .values({ key, value, updated_at: sql`CURRENT_TIMESTAMP` })
    .onConflictDoUpdate({
      target: syncMetadata.key,
      set: { value, updated_at: sql`CURRENT_TIMESTAMP` },
    })
    .run();
}

// SQLite reports constraint violations in the error message text; node:sqlite
// does not expose SQLITE_* result codes and drizzle wraps driver errors in
// DrizzleQueryError whose cause chain carries the original message. Only
// violations of the track schema itself (NOT NULL / UNIQUE / FOREIGN KEY /
// CHECK) are expected per-track failures — a property of the one row being
// persisted. Anything else (I/O errors, corruption, bugs) must escape so the
// whole apply rolls back to the previous library state.
function isTrackConstraintError(error: unknown): boolean {
  let cause: unknown = error;
  for (let depth = 0; depth < 5 && cause instanceof Error; depth += 1) {
    if (/constraint failed/i.test(cause.message)) return true;
    // Error.cause needs the ES2022 lib this package does not target; read it
    // structurally and keep loop-guarding it with instanceof.
    cause = (cause as Error & { cause?: unknown }).cause;
  }
  return false;
}

export const catalogSyncDb = {
  // Apply only the changed/deleted files reported by the scanner. Everything
  // runs in one transaction so a failure leaves the catalog untouched; the
  // `scanner_version` marker is stamped so the scanner can tell later runs
  // apart from the first one.
  applyIncremental(input: {
    upserts: MPDTrack[];
    deletions: string[];
  }): LibraryIncrementalResult {
    return transaction((tx) => {
      let synced = 0;
      let deleted = 0;
      let errors = 0;

      for (const track of input.upserts) {
        try {
          // Per-track savepoint: a rejected track must also roll back the
          // artist/album/genre lookup rows created for it, or repeated syncs
          // would leak orphan entities.
          tx.transaction((savepoint) => {
            upsertTrack(savepoint, track);
          });
        } catch (error) {
          if (!isTrackConstraintError(error)) throw error;
          console.error(`❌ Error syncing track ${track.file}:`, error);
          errors += 1;
          continue;
        }
        synced += 1;
      }

      for (const file of input.deletions) {
        // playlist_tracks.track_id cascades on delete (PRAGMA foreign_keys=ON),
        // so playlist rows for the removed file disappear with the track.
        tx.delete(tracksTable).where(eq(tracksTable.file, file)).run();
        deleted += 1;
      }

      stampMetadata(tx, "last_sync", new Date().toISOString());
      stampMetadata(tx, "scanner_version", SCANNER_VERSION);

      return { synced, deleted, errors };
    });
  },

  getScannerVersion(): string | undefined {
    return syncMetadataDb.get("scanner_version");
  },
};
