import { faker } from "@faker-js/faker";
import { artist } from "@tests/factories/artist.js";
import { album } from "@tests/factories/album.js";
import { track } from "@tests/factories/track.js";
import { albumsDb } from "@repo/db";
import type { DBArtist, DBAlbum, DBTrack } from "@repo/types";

type SeedOpts = {
  artists?: number;
  albumsPerArtist?: number;
  tracksPerAlbum?: number;
  withCovers?: boolean;
  seed?: number;
};

/**
 * Deterministic composite seeder for Trophy integration tests.
 * Uses real Drizzle writes via factories (artistsDb/albumsDb/tracksDb).
 * Deterministic when `seed` is provided (faker.seed per entity).
 * `withCovers=false` by default — pure DB; set true to exercise
 * `albumsDb.getCoverPreviews` / `cover_path` branch in `getAllArtists`.
 */
export function seedCatalog({
  artists: artistCount = 3,
  albumsPerArtist = 2,
  tracksPerAlbum = 1,
  withCovers = false,
  seed = 0,
}: SeedOpts = {}): {
  artists: DBArtist[];
  albums: DBAlbum[];
  tracks: DBTrack[];
} {
  const artists: DBArtist[] = [];
  const albums: DBAlbum[] = [];
  const tracks: DBTrack[] = [];

  for (let i = 0; i < artistCount; i++) {
    const aSeed = seed + i * 1000;
    faker.seed(aSeed);
    const a = artist.create({}, aSeed);
    artists.push(a);

    for (let j = 0; j < albumsPerArtist; j++) {
      const alSeed = seed + i * 1000 + j * 100 + 1;
      faker.seed(alSeed);
      const al = album.create({ artistName: a.name }, alSeed);
      // Ensure unique album per artist when faker might collide — suffix with index if needed
      albums.push(al);

      if (withCovers) {
        const coverPath = `covers/${al.id}-${faker.string.alphanumeric(6)}.jpg`;
        // Direct DB update to avoid fs/sharp side effects in catalog tests
        albumsDb.updateCoverPath(al.id, coverPath);
        // Reflect in returned object for assertions
        (al as DBAlbum).cover_path = coverPath;
      }

      for (let k = 0; k < tracksPerAlbum; k++) {
        const tSeed = seed + i * 1000 + j * 100 + k + 2;
        faker.seed(tSeed);
        const t = track.create({ artist: a.name, album: al.title }, tSeed);
        tracks.push(t);
      }
    }
  }

  return { artists, albums, tracks };
}
