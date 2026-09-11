import { albumsDb } from "@repo/db";
import { Album } from "@repo/types/library";

export interface AlbumService {
  getAlbumsByArtist(artistId: number): Promise<Album[]>;
  getAllAlbums(
    sort?: string,
    limit?: number,
    offset?: number,
  ): Promise<Album[]>;
  getAlbumCount(): Promise<number>;
  getRecentlyAddedAlbums(limit?: number): Promise<Album[]>;
  getAlbumById(id: number): Promise<Album | undefined>;
  updateAlbumCoverPath(albumId: number, coverPath: string): Promise<void>;
  getAlbumsByGenre(genre: string): Promise<Album[]>;
}

export class AlbumServiceImpl implements AlbumService {
  public async getAlbumsByArtist(artistId: number): Promise<Album[]> {
    return albumsDb.getByArtist(artistId);
  }

  public async getAllAlbums(
    sort?: string,
    limit?: number,
    offset?: number,
  ): Promise<Album[]> {
    return albumsDb.getAll({ sort, limit, offset });
  }

  public async getAlbumCount(): Promise<number> {
    return albumsDb.count();
  }

  public async getRecentlyAddedAlbums(limit = 20): Promise<Album[]> {
    return albumsDb.getRecent(limit);
  }

  public async getAlbumById(id: number): Promise<Album | undefined> {
    return albumsDb.getById(id);
  }
  public async getAlbumsByGenre(genre: string): Promise<Album[]> {
    return albumsDb.getByGenre(genre);
  }
  public async updateAlbumCoverPath(
    albumId: number,
    coverPath: string,
  ): Promise<void> {
    albumsDb.updateCoverPath(albumId, coverPath);
  }
}
