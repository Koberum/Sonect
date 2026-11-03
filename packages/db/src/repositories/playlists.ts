import { and, asc, eq, getColumns, isNotNull, ne, sql } from "drizzle-orm";
import type { DBPlaylist } from "@repo/types";
import type { PlaylistTrack } from "@repo/types/catalog";
import { db, transaction } from "../connection.js";
import {
  albums,
  artists,
  genres,
  playlistTracks,
  playlists,
  tracks,
} from "../tables.js";
import { normalizeRowId } from "./rowId.js";

// Domain row for playlist tracks - re-exports catalog PlaylistTrack plus junction meta.
export type PlaylistTrackRow = PlaylistTrack & {
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

  getCoverPreviews(playlistId: number, limit = 4): string[] {
    return db()
      .selectDistinct({ cover_path: albums.cover_path })
      .from(playlistTracks)
      .innerJoin(tracks, eq(playlistTracks.track_id, tracks.id))
      .innerJoin(albums, eq(tracks.album_id, albums.id))
      .where(
        and(
          eq(playlistTracks.playlist_id, playlistId),
          isNotNull(albums.cover_path),
          ne(albums.cover_path, ""),
        ),
      )
      .limit(limit)
      .all()
      .map((row) => row.cover_path)
      .filter((path): path is string => Boolean(path));
  },

  getTrackCount(playlistId: number): number {
    const row = db()
      .select({ count: sql<number>`count(*)` })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlist_id, playlistId))
      .get();
    return row?.count ?? 0;
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
        artist_name: sql<string>`coalesce(${artists.name}, '')`,
        album_title: albums.title,
        cover_path: sql<string>`coalesce(${albums.cover_path}, '')`,
        genre: genres.name,
        pt_id: playlistTracks.id,
        position: playlistTracks.position,
        added_at: playlistTracks.added_at,
      })
      .from(playlistTracks)
      .innerJoin(tracks, eq(playlistTracks.track_id, tracks.id))
      .leftJoin(artists, eq(tracks.artist_id, artists.id))
      .leftJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .where(eq(playlistTracks.playlist_id, playlistId))
      .orderBy(asc(playlistTracks.position))
      .all() as unknown as PlaylistTrackRow[];
  },
};
