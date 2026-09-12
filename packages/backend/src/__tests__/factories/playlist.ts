import { faker } from "@faker-js/faker";
import type { DBPlaylist } from "@repo/types";
import { playlistsDb } from "@repo/db";
import { track } from "./track.js";

export type PlaylistOverrides = Partial<
  Pick<DBPlaylist, "name" | "description">
> & {
  trackCount?: number;
};

export function buildPlaylist(
  overrides: PlaylistOverrides = {},
  seed?: number,
) {
  if (seed !== undefined) faker.seed(seed);
  return {
    name: overrides.name ?? `${faker.word.words(2)} playlist`,
    description: overrides.description ?? faker.lorem.sentence(),
    trackCount: overrides.trackCount ?? 0,
  };
}

export const playlist = {
  build(overrides: PlaylistOverrides = {}, seed?: number) {
    return buildPlaylist(overrides, seed);
  },

  create(overrides: PlaylistOverrides = {}, seed?: number): DBPlaylist {
    const data = buildPlaylist(overrides, seed);
    const id = playlistsDb.create(data.name, data.description);
    const pl = playlistsDb.getById(id);
    if (!pl)
      throw new Error("playlist.create: failed to read back inserted row");
    if (data.trackCount > 0) {
      for (let i = 0; i < data.trackCount; i++) {
        const t = track.create(
          {},
          seed !== undefined ? seed + i + 1000 : undefined,
        );
        playlistsDb.addTrack(pl.id, t.id);
      }
    }
    return pl;
  },

  createMany(
    count: number,
    overrides: PlaylistOverrides = {},
    seed?: number,
  ): DBPlaylist[] {
    if (seed !== undefined) faker.seed(seed);
    return Array.from({ length: count }, () => playlist.create(overrides));
  },
};
