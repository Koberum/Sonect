import { Track, TrackWithRelations } from "@repo/types/library";
import { albumsDb, artistsDb, tracksDb } from "@repo/db";

export interface TrackService {
  getTracksByAlbum(albumId: number): TrackWithRelations[];
  getTracksByArtist(artistId: number): TrackWithRelations[];
  getAllTracks(sort?: string, limit?: number, offset?: number): Track[];
  getTrackCount(): number;
  getTrackById(id: number): Track | undefined;
  resolveTrack(
    artist: string,
    album: string,
    title: string,
  ): TrackWithRelations | null;
  getTracksByGenre(genre: string): Track[];
  getRecentlyAddedTracks(limit?: number): Track[];

  getTrackById(id: number): TrackWithRelations | undefined;
  getAllTracks(
    sort?: string,
    limit?: number,
    offset?: number,
  ): TrackWithRelations[];
  getRecentlyAddedTracks(limit?: number): TrackWithRelations[];
  getTracksByGenre(genre: string): TrackWithRelations[];
}

export class TrackServiceImpl implements TrackService {
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
}

export const trackService = new TrackServiceImpl();
