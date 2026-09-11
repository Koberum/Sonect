import { genresDb } from "@repo/db";
import { Genre } from "@repo/types/library";

export interface GenreService {
  getGenres(): Promise<Genre[]>;
  getById(id: number): Promise<Genre | undefined>;
}

export class GenreServiceImpl implements GenreService {
  public async getGenres(): Promise<Genre[]> {
    return genresDb.getAll();
  }

  public async getById(id: number): Promise<Genre | undefined> {
    return genresDb.getById(id);
  }
}
