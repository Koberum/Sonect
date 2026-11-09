import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { AudioQuality, DBTrackWithRelations } from "@repo/types";
import { db } from "../connection.js";
import { albums, artists, genres, likedTracks, tracks } from "../tables.js";
import { dBTrackWithRelations } from "./tracks.js";

export type LikedQualityFilter = {
  bitsPerSample: number | null;
  sampleRate: number | null;
};

export type LikedSort = "recent" | "quality-desc" | "quality-asc";

export type LikedListOptions = {
  limit?: number;
  offset?: number;
  quality?: LikedQualityFilter;
  sort?: LikedSort;
};

export type LikedSummary = {
  count: number;
  totalDuration: number;
};

const likedOrder = [desc(likedTracks.liked_at), desc(likedTracks.id)] as const;

function likedWhere(profileId: string, quality?: LikedQualityFilter) {
  const profile = eq(likedTracks.profile_id, profileId);
  if (!quality) return profile;
  return and(
    profile,
    quality.bitsPerSample === null
      ? isNull(tracks.bits_per_sample)
      : eq(tracks.bits_per_sample, quality.bitsPerSample),
    quality.sampleRate === null
      ? isNull(tracks.sample_rate)
      : eq(tracks.sample_rate, quality.sampleRate),
  );
}

function likedOrderFor(sort: LikedSort = "recent") {
  if (sort === "recent") return likedOrder;
  const bitsDirection =
    sort === "quality-desc"
      ? desc(tracks.bits_per_sample)
      : asc(tracks.bits_per_sample);
  const rateDirection =
    sort === "quality-desc"
      ? desc(tracks.sample_rate)
      : asc(tracks.sample_rate);
  return [
    asc(sql`${tracks.bits_per_sample} IS NULL`),
    bitsDirection,
    asc(sql`${tracks.sample_rate} IS NULL`),
    rateDirection,
    ...likedOrder,
  ];
}

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
    {
      limit = 100,
      offset = 0,
      quality,
      sort = "recent",
    }: LikedListOptions = {},
  ): DBTrackWithRelations[] {
    return db()
      .select(dBTrackWithRelations)
      .from(likedTracks)
      .innerJoin(tracks, eq(likedTracks.track_id, tracks.id))
      .leftJoin(artists, eq(tracks.artist_id, artists.id))
      .leftJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .where(likedWhere(profileId, quality))
      .orderBy(...likedOrderFor(sort))
      .limit(limit)
      .offset(offset)
      .all() as DBTrackWithRelations[];
  },

  qualities(profileId: string): AudioQuality[] {
    return db()
      .selectDistinct({
        bits_per_sample: tracks.bits_per_sample,
        sample_rate: tracks.sample_rate,
      })
      .from(likedTracks)
      .innerJoin(tracks, eq(likedTracks.track_id, tracks.id))
      .where(
        and(
          eq(likedTracks.profile_id, profileId),
          or(
            sql`${tracks.bits_per_sample} IS NOT NULL`,
            sql`${tracks.sample_rate} IS NOT NULL`,
          ),
        ),
      )
      .orderBy(
        asc(sql`${tracks.bits_per_sample} IS NULL`),
        desc(tracks.bits_per_sample),
        asc(sql`${tracks.sample_rate} IS NULL`),
        desc(tracks.sample_rate),
      )
      .all() as AudioQuality[];
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

  files(
    profileId: string,
    quality?: LikedQualityFilter,
    sort: LikedSort = "recent",
  ): string[] {
    return db()
      .select({ file: tracks.file })
      .from(likedTracks)
      .innerJoin(tracks, eq(likedTracks.track_id, tracks.id))
      .where(likedWhere(profileId, quality))
      .orderBy(...likedOrderFor(sort))
      .all()
      .map((row) => row.file);
  },

  summary(profileId: string, quality?: LikedQualityFilter): LikedSummary {
    const row = db()
      .select({
        count: count(),
        totalDuration: sql<number>`coalesce(sum(${tracks.duration}), 0)`,
      })
      .from(likedTracks)
      .innerJoin(tracks, eq(likedTracks.track_id, tracks.id))
      .where(likedWhere(profileId, quality))
      .get();
    return {
      count: row?.count ?? 0,
      totalDuration: Number(row?.totalDuration ?? 0),
    };
  },
};
