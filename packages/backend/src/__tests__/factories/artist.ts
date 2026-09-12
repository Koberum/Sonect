import { faker } from "@faker-js/faker";
import type { DBArtist } from "@repo/types";
import { artistsDb } from "@repo/db";

export type ArtistOverrides = Partial<Pick<DBArtist, "name">>;

export function buildArtist(overrides: ArtistOverrides = {}, seed?: number) {
  if (seed !== undefined) faker.seed(seed);
  return {
    name: overrides.name ?? faker.person.fullName(),
  };
}

export const artist = {
  build(overrides: ArtistOverrides = {}, seed?: number) {
    return buildArtist(overrides, seed);
  },

  create(overrides: ArtistOverrides = {}, seed?: number): DBArtist {
    const data = buildArtist(overrides, seed);
    const id = artistsDb.findOrCreate(data.name);
    const row = artistsDb.getById(id);
    if (!row)
      throw new Error("artist.create: failed to read back inserted row");
    return row;
  },

  createMany(
    count: number,
    overrides: ArtistOverrides = {},
    seed?: number,
  ): DBArtist[] {
    if (seed !== undefined) faker.seed(seed);
    return Array.from({ length: count }, () => artist.create(overrides));
  },
};
