import { genresDb } from "@repo/db";

interface GenreService {
  getGenres(): Promise<
    { genre: string; track_count: number; album_count: number }[]
  >;
}

class GenreServiceImpl implements GenreService {
  public async getGenres(): Promise<
    { genre: string; track_count: number; album_count: number }[]
  > {
    return genresDb.getAll();
  }
}

export const genreService: GenreService = new GenreServiceImpl();
