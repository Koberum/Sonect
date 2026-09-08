import { eq, sql } from "drizzle-orm";
import type { MPDTrack } from "@repo/types";
import { transaction, type DatabaseTransaction } from "../connection.js";
import {
  albums,
  artists,
  genres,
  syncMetadata,
  tracks as tracksTable,
} from "../tables.js";
import { upsertTrack } from "./tracks.js";

export type LibraryRebuildResult = {
  synced: number;
  errors: number;
};

// SQLite reports constraint violations in the error message text; node:sqlite
// does not expose SQLITE_* result codes and drizzle wraps driver errors in
// DrizzleQueryError whose cause chain carries the original message. Only
// violations of the track schema itself (NOT NULL / UNIQUE / FOREIGN KEY /
// CHECK) are expected per-track failures — a property of the one row being
// persisted. Anything else (I/O errors, corruption, bugs) must escape so the
// complete rebuild rolls back to the previous library state.
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

// One transaction wipes and repopulates the music tables. Every step runs on
// the transaction executor so a failure anywhere restores the pre-rebuild
// library exactly as it was.
function rebuildInTransaction(
  executor: DatabaseTransaction,
  tracks: MPDTrack[],
  onProgress?: (completed: number, track: MPDTrack) => void,
): LibraryRebuildResult {
  // Step 1: snapshot playback statistics keyed by file before any destructive
  // work, so surviving files keep their play counts.
  const previousStats = new Map(
    executor
      .select({
        file: tracksTable.file,
        play_count: tracksTable.play_count,
        last_played: tracksTable.last_played,
      })
      .from(tracksTable)
      .all()
      .map((row) => [row.file, row] as const),
  );

  // Step 2: FK-safe wipe (tracks reference albums, artists, and genres; albums reference artists and genres).
  executor.delete(tracksTable).run();
  executor.delete(albums).run();
  executor.delete(artists).run();
  executor.delete(genres).run();

  let synced = 0;
  let errors = 0;

  for (const track of tracks) {
    try {
      // Step 3: each track persists inside a savepoint so a rejected track
      // also rolls back the artist and album rows created for it.
      executor.transaction((savepoint) => {
        const id = upsertTrack(savepoint, track);
        // Step 4: restore playback fields for surviving files.
        const stats = previousStats.get(track.file);
        if (stats) {
          savepoint
            .update(tracksTable)
            .set({
              play_count: stats.play_count ?? 0,
              last_played: stats.last_played,
            })
            .where(eq(tracksTable.id, id))
            .run();
        }
      });
    } catch (error) {
      if (!isTrackConstraintError(error)) throw error;
      // Keep individual malformed tracks operator-reportable, as they were
      // before the rebuild became transactional.
      console.error(`❌ Error syncing track ${track.file}:`, error);
      errors += 1;
      continue;
    }

    // Step 6: progress fires only after the track is durably persisted within
    // the transaction. A throwing callback escapes and rolls back everything.
    synced += 1;
    onProgress?.(synced, track);
  }

  // Step 5: stamp the sync timestamp inside the same transaction.
  const timestamp = new Date().toISOString();
  executor
    .insert(syncMetadata)
    .values({
      key: "last_sync",
      value: timestamp,
      updated_at: sql`CURRENT_TIMESTAMP`,
    })
    .onConflictDoUpdate({
      target: syncMetadata.key,
      set: { value: timestamp, updated_at: sql`CURRENT_TIMESTAMP` },
    })
    .run();

  return { synced, errors };
}

export const librarySyncDb = {
  rebuild(
    tracks: MPDTrack[],
    onProgress?: (completed: number, track: MPDTrack) => void,
  ): LibraryRebuildResult {
    return transaction((tx) => rebuildInTransaction(tx, tracks, onProgress));
  },

  clearAll(): void {
    transaction((tx) => {
      tx.delete(tracksTable).run();
      tx.delete(albums).run();
      tx.delete(artists).run();
      tx.delete(genres).run();
      tx.delete(syncMetadata).run();
    });
  },
};
