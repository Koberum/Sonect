import {
  and,
  desc,
  eq,
  getColumns,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import type { Album, DBArtist, DBTrackWithRelations } from "@repo/types";
import { db } from "../connection.js";
import { albums, artists, genres, playHistory, tracks } from "../tables.js";
import { albumWithArtist } from "./albums.js";
import { dBTrackWithRelations } from "./tracks.js";

export const playHistoryDb = {
  record(profileId: string, trackId: number, playedAt = Date.now()): void {
    db()
      .insert(playHistory)
      .values({
        profile_id: profileId,
        track_id: trackId,
        played_at: playedAt,
      })
      .run();
  },

  hasHistory(profileId: string): boolean {
    const row = db()
      .select({ id: playHistory.id })
      .from(playHistory)
      .where(eq(playHistory.profile_id, profileId))
      .limit(1)
      .get();
    return row !== undefined;
  },

  recentTracks(profileId: string, limit: number): DBTrackWithRelations[] {
    const latest = db()
      .select({
        track_id: playHistory.track_id,
        played_at: sql<number>`max(${playHistory.played_at})`.as("played_at"),
      })
      .from(playHistory)
      .where(eq(playHistory.profile_id, profileId))
      .groupBy(playHistory.track_id)
      .as("latest_track_play");

    return db()
      .select(dBTrackWithRelations)
      .from(latest)
      .innerJoin(tracks, eq(tracks.id, latest.track_id))
      .innerJoin(artists, eq(tracks.artist_id, artists.id))
      .innerJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .orderBy(desc(latest.played_at))
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },

  recentAlbums(
    profileId: string,
    limit: number,
    excludeAlbumId?: number,
  ): Album[] {
    return db()
      .select(albumWithArtist)
      .from(playHistory)
      .innerJoin(tracks, eq(tracks.id, playHistory.track_id))
      .innerJoin(albums, eq(albums.id, tracks.album_id))
      .leftJoin(artists, eq(albums.artist_id, artists.id))
      .leftJoin(genres, eq(albums.genre_id, genres.id))
      .where(
        and(
          eq(playHistory.profile_id, profileId),
          excludeAlbumId !== undefined
            ? ne(albums.id, excludeAlbumId)
            : undefined,
        ),
      )
      .groupBy(albums.id)
      .orderBy(desc(sql`max(${playHistory.played_at})`))
      .limit(limit)
      .all() as Album[];
  },

  recentArtists(profileId: string, limit: number): DBArtist[] {
    return db()
      .select(getColumns(artists))
      .from(playHistory)
      .innerJoin(tracks, eq(tracks.id, playHistory.track_id))
      .innerJoin(artists, eq(artists.id, tracks.artist_id))
      .where(eq(playHistory.profile_id, profileId))
      .groupBy(artists.id)
      .orderBy(desc(sql`max(${playHistory.played_at})`))
      .limit(limit)
      .all() as DBArtist[];
  },

  topTracks(profileId: string, limit: number): DBTrackWithRelations[] {
    const counts = db()
      .select({
        track_id: playHistory.track_id,
        plays: sql<number>`count(*)`.as("plays"),
        last_played: sql<number>`max(${playHistory.played_at})`.as(
          "last_played",
        ),
      })
      .from(playHistory)
      .where(eq(playHistory.profile_id, profileId))
      .groupBy(playHistory.track_id)
      .as("profile_track_plays");

    return db()
      .select(dBTrackWithRelations)
      .from(counts)
      .innerJoin(tracks, eq(tracks.id, counts.track_id))
      .innerJoin(artists, eq(tracks.artist_id, artists.id))
      .innerJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .orderBy(desc(counts.plays), desc(counts.last_played))
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },

  topGenres(profileId: string, limit: number): string[] {
    return db()
      .select({ genre: genres.name })
      .from(playHistory)
      .innerJoin(tracks, eq(tracks.id, playHistory.track_id))
      .innerJoin(genres, eq(genres.id, tracks.genre_id))
      .where(eq(playHistory.profile_id, profileId))
      .groupBy(genres.id, genres.name)
      .orderBy(desc(sql`count(*)`))
      .limit(limit)
      .all()
      .map((row) => row.genre);
  },

  topArtists(
    profileId: string,
    limit: number,
  ): { id: number; name: string; total: number }[] {
    return db()
      .select({
        id: artists.id,
        name: artists.name,
        total: sql<number>`count(*)`,
      })
      .from(playHistory)
      .innerJoin(tracks, eq(tracks.id, playHistory.track_id))
      .innerJoin(artists, eq(artists.id, tracks.artist_id))
      .where(eq(playHistory.profile_id, profileId))
      .groupBy(artists.id)
      .orderBy(desc(sql`count(*)`))
      .limit(limit)
      .all() as { id: number; name: string; total: number }[];
  },

  topGenre(profileId: string): string | null {
    const row = db()
      .select({ genre: genres.name })
      .from(playHistory)
      .innerJoin(tracks, eq(tracks.id, playHistory.track_id))
      .innerJoin(genres, eq(genres.id, tracks.genre_id))
      .where(eq(playHistory.profile_id, profileId))
      .groupBy(genres.id, genres.name)
      .orderBy(desc(sql`count(*)`))
      .limit(1)
      .get();
    return row?.genre ?? null;
  },

  discoveryTracks(
    profileId: string,
    genreNames: string[],
    artistIds: number[],
    limit: number,
  ): DBTrackWithRelations[] {
    if (genreNames.length === 0 && artistIds.length === 0) return [];

    const counts = db()
      .select({
        track_id: playHistory.track_id,
        plays: sql<number>`count(*)`.as("plays"),
      })
      .from(playHistory)
      .where(eq(playHistory.profile_id, profileId))
      .groupBy(playHistory.track_id)
      .as("profile_track_plays");

    const scope = or(
      genreNames.length > 0 ? inArray(genres.name, genreNames) : undefined,
      artistIds.length > 0 ? inArray(tracks.artist_id, artistIds) : undefined,
    );

    return db()
      .select(dBTrackWithRelations)
      .from(tracks)
      .leftJoin(counts, eq(counts.track_id, tracks.id))
      .innerJoin(artists, eq(tracks.artist_id, artists.id))
      .innerJoin(albums, eq(tracks.album_id, albums.id))
      .leftJoin(genres, eq(tracks.genre_id, genres.id))
      .where(and(scope, or(isNull(counts.plays), lt(counts.plays, 3))))
      .orderBy(sql`random()`)
      .limit(limit)
      .all() as DBTrackWithRelations[];
  },
};
