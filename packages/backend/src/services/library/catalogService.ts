import { albumsDb, artistsDb, genresDb, statsDb, tracksDb } from "@repo/db";
import type {
  Album,
  Artist,
  Genre,
  LibraryStats,
  SearchResults,
  TrackWithRelations,
} from "@repo/types/library";

export interface CatalogService {
  // Artist
  getAllArtists(limit?: number, offset?: number): Artist[];
  getArtistCount(): number;
  getArtistById(id: number): Artist | undefined;

  // Album
  getAlbumsByArtist(artistId: number): Album[];
  getAllAlbums(sort?: string, limit?: number, offset?: number): Album[];
  getAlbumCount(): number;
  getRecentlyAddedAlbums(limit?: number): Album[];
  getAlbumById(id: number): Album | undefined;
  updateAlbumCoverPath(albumId: number, coverPath: string): void;
  getAlbumsByGenre(genre: string): Album[];

  // Genre
  getGenres(): Genre[];
  getGenreById(id: number): Genre | undefined;
  /** @deprecated use getGenreById — kept for GenreService compat */
  getById(id: number): Genre | undefined;

  // Track
  getTracksByAlbum(albumId: number): TrackWithRelations[];
  getTracksByArtist(artistId: number): TrackWithRelations[];
  getAllTracks(
    sort?: string,
    limit?: number,
    offset?: number,
  ): TrackWithRelations[];
  getTrackCount(): number;
  getTrackById(id: number): TrackWithRelations | undefined;
  resolveTrack(
    artist: string,
    album: string,
    title: string,
  ): TrackWithRelations | null;
  getTracksByGenre(genre: string): TrackWithRelations[];
  getRecentlyAddedTracks(limit?: number): TrackWithRelations[];

  // Search
  searchTracks(query: string): SearchResults;

  // Stats
  getLibraryStats(): LibraryStats;
}

export class CatalogServiceImpl implements CatalogService {
  // Artist
  public getAllArtists(limit?: number, offset?: number): Artist[] {
    const artists = artistsDb.getAll({ limit, offset });
    return artists.map((artist) => ({
      ...artist,
      coverPreviews: albumsDb.getCoverPreviews(artist.id, 4), // TODO: Optimize here with single sync join query on db
    }));
  }

  public getArtistCount(): number {
    return artistsDb.count();
  }

  public getArtistById(id: number): Artist | undefined {
    return artistsDb.getById(id);
  }

  // Album
  public getAlbumsByArtist(artistId: number): Album[] {
    return albumsDb.getByArtist(artistId);
  }

  public getAllAlbums(sort?: string, limit?: number, offset?: number): Album[] {
    return albumsDb.getAll({ sort, limit, offset });
  }

  public getAlbumCount(): number {
    return albumsDb.count();
  }

  public getRecentlyAddedAlbums(limit = 20): Album[] {
    return albumsDb.getRecent(limit);
  }

  public getAlbumById(id: number): Album | undefined {
    return albumsDb.getById(id);
  }

  public getAlbumsByGenre(genre: string): Album[] {
    return albumsDb.getByGenre(genre);
  }

  public updateAlbumCoverPath(albumId: number, coverPath: string): void {
    albumsDb.updateCoverPath(albumId, coverPath);
  }

  // Genre
  public getGenres(): Genre[] {
    return genresDb.getAll();
  }

  public getGenreById(id: number): Genre | undefined {
    return genresDb.getById(id);
  }

  public getById(id: number): Genre | undefined {
    return this.getGenreById(id);
  }

  // Track
  public getRecentlyAddedTracks(limit = 20): TrackWithRelations[] {
    const dbTracks = tracksDb.getRecentWithRelations(limit);
    return dbTracks as TrackWithRelations[];
  }

  public getTracksByGenre(genre: string): TrackWithRelations[] {
    const dbTracks = tracksDb.getByGenreWithRelations(genre);
    return dbTracks as TrackWithRelations[];
  }

  public resolveTrack(
    artist: string,
    album: string,
    title: string,
  ): TrackWithRelations | null {
    const dbTrack = tracksDb.getByArtistAlbumTitle(artist, album, title);
    if (!dbTrack) return null;
    return dbTrack as TrackWithRelations;
  }

  public getTracksByAlbum(albumId: number): TrackWithRelations[] {
    const album = albumsDb.getById(albumId);
    if (!album) throw new Error("Album not found");
    return tracksDb.getByAlbumWithRelations(albumId).map((dbTrack) => ({
      ...dbTrack,
      cover_path: album.cover_path ?? "",
      album_name: album.title,
      artist_name: dbTrack.artist_name ?? album.artist_name ?? "",
      genre: dbTrack.genre ?? album.genre ?? undefined,
    }));
  }

  public getTracksByArtist(artistId: number): TrackWithRelations[] {
    const artist = artistsDb.getById(artistId);
    if (!artist) throw new Error("Artist not found");
    return tracksDb.getByArtistWithRelations(artistId);
  }

  public getAllTracks(
    sort?: string,
    limit?: number,
    offset?: number,
  ): TrackWithRelations[] {
    const dbTracks = tracksDb.getAllWithRelations(sort, limit, offset);
    return dbTracks as TrackWithRelations[];
  }

  public getTrackCount(): number {
    return tracksDb.count();
  }

  public getTrackById(id: number): TrackWithRelations | undefined {
    return tracksDb.getByIdWithRelations(id);
  }

  public searchTracks(query: string): SearchResults {
    const q = query.toLowerCase();
    const matchedArtists = artistsDb.search(q);
    const artists = matchedArtists.map((artist) => ({
      ...artist,
      coverPreviews: albumsDb.getCoverPreviews(artist.id, 4),
    }));
    const albums = albumsDb.search(q);
    const tracks = tracksDb.search(query);
    return { artists, albums, tracks };
  }

  public getLibraryStats(): LibraryStats {
    return statsDb.getStats();
  }
}
