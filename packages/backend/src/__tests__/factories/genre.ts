import { faker } from "@faker-js/faker";
import type { DBGenre } from "@repo/types";
import { genresDb } from "@repo/db";

export type GenreOverrides = Partial<Pick<DBGenre, "name">>;

export function buildGenre(overrides: GenreOverrides = {}, seed?: number) {
  if (seed !== undefined) faker.seed(seed);
  return {
    name: overrides.name ?? faker.music.genre(),
  };
}

export const genre = {
  build(overrides: GenreOverrides = {}, seed?: number) {
    return buildGenre(overrides, seed);
  },

  create(overrides: GenreOverrides = {}, seed?: number): DBGenre {
    const data = buildGenre(overrides, seed);
    const id = genresDb.findOrCreate(data.name);
    const row = genresDb.getById(id);
    if (!row) throw new Error("genre.create: failed to read back inserted row");
    return row;
  },

  createMany(
    count: number,
    overrides: GenreOverrides = {},
    seed?: number,
  ): DBGenre[] {
    if (seed !== undefined) faker.seed(seed);
    return Array.from({ length: count }, () => genre.create(overrides));
  },
};
