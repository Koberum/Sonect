import { count, desc, eq, sql } from "drizzle-orm";
import type { DBTrackWithRelations } from "@repo/types";
import { db } from "../connection.js";
import { albums, artists, genres, likedTracks, tracks } from "../tables.js";
import { dBTrackWithRelations } from "./tracks.js";

export type LikedListOptions = {
  limit?: number;
  offset?: number;
};

export type LikedSummary = {
  count: number;
  totalDuration: number;
};

const likedOrder = [desc(likedTracks.liked_at), desc(likedTracks.id)] as const;

export const likedDb = {
  add(profileId: string, trackId: number): boolean {
    const result = db()
      .insert(likedTracks)
      .values({
        profile_id: profileId,
        track_id: trackId,
        liked_at: Date.now(),
      })
      .onConflictDoNothing()
      .run();
    return (result.changes ?? 0) > 0;
  },

  remove(profileId: string, trackId: number): boolean {
    const result = db()
      .delete(likedTracks)
      .where(
        sql`${likedTracks.profile_id} = ${profileId} AND ${likedTracks.track_id} = ${trackId}`,
      )
      .run();
    return (result.changes ?? 0) > 0;
  },

  list(
    profileId: string,
    { limit = 100, offset = 0 }: LikedListOptions = {},
  ): DBTrackWithRelations[] {
    return db()
      .select(dBTrackWithRelations)
      .from(likedTracks)
      .innerJoin(tracks, eq(likedTracks.track_id, tracks.id))
      .leftJoin(artists, eq(tracks.artist_id, artists.id))
      .leftJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .where(eq(likedTracks.profile_id, profileId))
      .orderBy(...likedOrder)
      .limit(limit)
      .offset(offset)
      .all() as DBTrackWithRelations[];
  },

  ids(profileId: string): number[] {
    return db()
      .select({ id: likedTracks.track_id })
      .from(likedTracks)
      .where(eq(likedTracks.profile_id, profileId))
      .orderBy(...likedOrder)
      .all()
      .map((row) => row.id);
  },

  files(profileId: string): string[] {
    return db()
      .select({ file: tracks.file })
      .from(likedTracks)
      .innerJoin(tracks, eq(likedTracks.track_id, tracks.id))
      .where(eq(likedTracks.profile_id, profileId))
      .orderBy(...likedOrder)
      .all()
      .map((row) => row.file);
  },

  summary(profileId: string): LikedSummary {
    const row = db()
      .select({
        count: count(),
        totalDuration: sql<number>`coalesce(sum(${tracks.duration}), 0)`,
      })
      .from(likedTracks)
      .innerJoin(tracks, eq(likedTracks.track_id, tracks.id))
      .where(eq(likedTracks.profile_id, profileId))
      .get();
    return {
      count: row?.count ?? 0,
      totalDuration: Number(row?.totalDuration ?? 0),
    };
  },

  isLiked(profileId: string, trackId: number): boolean {
    const row = db()
      .select({ id: likedTracks.id })
      .from(likedTracks)
      .where(
        sql`${likedTracks.profile_id} = ${profileId} AND ${likedTracks.track_id} = ${trackId}`,
      )
      .get();
    return Boolean(row);
  },
};
