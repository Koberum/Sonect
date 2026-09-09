import { Artist } from "@repo/types/library";
import { artistsDb, albumsDb } from "@repo/db";

interface ArtistService {
  getAllArtists(limit?: number, offset?: number): Promise<Artist[]>;
  getArtistCount(): Promise<number>;
  getArtistById(id: number): Promise<Artist | undefined>;
}

class ArtistServiceImpl implements ArtistService {
  public async getAllArtists(
    limit?: number,
    offset?: number,
  ): Promise<Artist[]> {
    const artists = artistsDb.getAll({ limit, offset });
    return artists.map((artist) => ({
      ...artist,
      coverPreviews: albumsDb.getCoverPreviews(artist.id, 4),
    }));
  }

  public async getArtistCount(): Promise<number> {
    return artistsDb.count();
  }

  public async getArtistById(id: number): Promise<Artist | undefined> {
    return artistsDb.getById(id);
  }
}

export const artistService: ArtistService = new ArtistServiceImpl();
