import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm";
import type { DBTrack, MPDTrack } from "@repo/types";
import { db, tracks, tracksDb } from "@repo/db";

export type TrackOverrides = Partial<{
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  genre: string;
  file: string;
  duration: number;
  track: number;
  disc: string;
  date: string;
  lastModified: string;
  play_count: number;
  last_played: string;
}>;

export function buildTrack(
  overrides: TrackOverrides = {},
  seed?: number,
): MPDTrack {
  if (seed !== undefined) faker.seed(seed);
  const title = overrides.title ?? faker.music.songName();
  const artist = overrides.artist ?? faker.person.fullName();
  const album = overrides.album ?? faker.music.songName();
  const genre = overrides.genre ?? faker.music.genre();
  const file =
    overrides.file ??
    `${faker.word.words(1).replace(/\s+/g, "_")}/${faker.string.alphanumeric(8)}.mp3`;
  return {
    file,
    title,
    artist,
    album,
    albumArtist: overrides.albumArtist,
    genre,
    duration:
      overrides.duration ??
      faker.number.float({ min: 90, max: 400, multipleOf: 0.1 }),
    track: overrides.track ?? faker.number.int({ min: 1, max: 12 }),
    disc: overrides.disc ?? String(faker.number.int({ min: 1, max: 2 })),
    date: overrides.date ?? String(faker.number.int({ min: 1970, max: 2025 })),
    lastModified: overrides.lastModified ?? new Date().toISOString(),
  };
}

export const track = {
  /** Build a faker MPDTrack payload without persisting */
  build(overrides: TrackOverrides = {}, seed?: number): MPDTrack {
    return buildTrack(overrides, seed);
  },

  /** Persist a faker track via real Drizzle upsert and return the typed DBTrack row */
  create(overrides: TrackOverrides = {}, seed?: number): DBTrack {
    const payload = buildTrack(overrides, seed);
    const id = tracksDb.upsert(payload);

    // Rehydrate with play_count/last_played overrides if supplied
    if (
      overrides.play_count !== undefined ||
      overrides.last_played !== undefined
    ) {
      const patch: Record<string, unknown> = {};
      if (overrides.play_count !== undefined)
        patch.play_count = overrides.play_count;
      if (overrides.last_played !== undefined)
        patch.last_played = overrides.last_played;
      if (Object.keys(patch).length > 0) {
        db()
          .update(tracks)
          .set({ ...patch, updated_at: sql`CURRENT_TIMESTAMP` })
          .where(eq(tracks.id, id))
          .run();
      }
    }

    const row = tracksDb.getById(id);
    if (!row) throw new Error("track.create: failed to read back inserted row");
    return row;
  },

  createMany(
    count: number,
    overrides: TrackOverrides = {},
    seed?: number,
  ): DBTrack[] {
    if (seed !== undefined) faker.seed(seed);
    return Array.from({ length: count }, () => track.create(overrides));
  },
};
