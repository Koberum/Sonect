import { faker } from "@faker-js/faker";
import type { DBAlbum } from "@repo/types";
import { albumsDb, artistsDb } from "@repo/db";

export type AlbumOverrides = Partial<Pick<DBAlbum, "title" | "year">> & {
  artistName?: string;
  genreName?: string;
};

export function buildAlbum(overrides: AlbumOverrides = {}, seed?: number) {
  if (seed !== undefined) faker.seed(seed);
  return {
    title: overrides.title ?? faker.music.songName(),
    artistName: overrides.artistName ?? faker.person.fullName(),
    year: overrides.year ?? faker.number.int({ min: 1970, max: 2025 }),
    genreName: overrides.genreName,
  };
}

export const album = {
  build(overrides: AlbumOverrides = {}, seed?: number) {
    return buildAlbum(overrides, seed);
  },

  create(overrides: AlbumOverrides = {}, seed?: number): DBAlbum {
    const data = buildAlbum(overrides, seed);
    const artistId = artistsDb.findOrCreate(data.artistName);
    const id = albumsDb.findOrCreate(
      data.title,
      artistId,
      data.year,
      data.genreName,
    );
    const row = albumsDb.getById(id);
    if (!row) throw new Error("album.create: failed to read back inserted row");
    return row as DBAlbum;
  },

  createMany(
    count: number,
    overrides: AlbumOverrides = {},
    seed?: number,
  ): DBAlbum[] {
    if (seed !== undefined) faker.seed(seed);
    return Array.from({ length: count }, () => album.create(overrides));
  },
};
