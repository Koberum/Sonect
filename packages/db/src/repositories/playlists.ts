import { asc, eq, getColumns, sql } from "drizzle-orm";
import type { DBPlaylist, DBTrack } from "@repo/types";
import { db, transaction } from "../connection.js";
import { playlistTracks, playlists, tracks } from "../tables.js";
import { normalizeRowId } from "./rowId.js";

// A track row joined with its playlist membership, as consumed by the
// playlist API: track columns plus the junction row id, position, and the
// moment the track was added.
export type PlaylistTrackRow = DBTrack & {
  pt_id: number;
  position: number;
  added_at?: string;
};

export const playlistsDb = {
  getAll(): DBPlaylist[] {
    return db()
      .select()
      .from(playlists)
      .orderBy(asc(playlists.name))
      .all() as DBPlaylist[];
  },

  getById(id: number): DBPlaylist | undefined {
    return db().select().from(playlists).where(eq(playlists.id, id)).get() as
      DBPlaylist | undefined;
  },

  create(name: string, description?: string): number {
    const result = db()
      .insert(playlists)
      .values({ name, description: description || null })
      .run();
    return normalizeRowId(result.lastInsertRowid);
  },

  update(id: number, data: { name?: string; description?: string }): void {
    if (data.name === undefined && data.description === undefined) return;
    db()
      .update(playlists)
      .set({
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        updated_at: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(playlists.id, id))
      .run();
  },

  delete(id: number): void {
    db().delete(playlistTracks).where(eq(playlistTracks.playlist_id, id)).run();
    db().delete(playlists).where(eq(playlists.id, id)).run();
  },

  addTrack(playlistId: number, trackId: number): void {
    // Position selection and insertion share one synchronous transaction so
    // the max position is computed and consumed atomically. Only the unique
    // (playlist_id, track_id) conflict is silenced — a duplicate add is a
    // no-op — while every other SQLite error (e.g. a missing playlist or
    // track) still surfaces to the caller.
    transaction((tx) => {
      const row = tx
        .select({
          maxPos: sql<number>`coalesce(max(${playlistTracks.position}), -1)`,
        })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlist_id, playlistId))
        .get();
      tx.insert(playlistTracks)
        .values({
          playlist_id: playlistId,
          track_id: trackId,
          position: (row?.maxPos ?? -1) + 1,
        })
        .onConflictDoNothing({
          target: [playlistTracks.playlist_id, playlistTracks.track_id],
        })
        .run();
    });
  },

  removeTrack(playlistTrackId: number): void {
    db()
      .delete(playlistTracks)
      .where(eq(playlistTracks.id, playlistTrackId))
      .run();
  },

  getTracks(playlistId: number): PlaylistTrackRow[] {
    return db()
      .select({
        ...getColumns(tracks),
        pt_id: playlistTracks.id,
        position: playlistTracks.position,
        added_at: playlistTracks.added_at,
      })
      .from(playlistTracks)
      .innerJoin(tracks, eq(playlistTracks.track_id, tracks.id))
      .where(eq(playlistTracks.playlist_id, playlistId))
      .orderBy(asc(playlistTracks.position))
      .all() as PlaylistTrackRow[];
  },
};
