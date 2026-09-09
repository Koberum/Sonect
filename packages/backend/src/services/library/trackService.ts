import { Track, TrackWithRelations } from "@repo/types/library";
import { albumsDb, artistsDb, tracksDb } from "@repo/db";

interface TrackService {
  getTracksByAlbum(albumId: number): TrackWithRelations[];
  getTracksByArtist(artistId: number): TrackWithRelations[];
  getAllTracks(sort?: string, limit?: number, offset?: number): Track[];
  getTrackCount(): number;
  getTrackById(id: number): Track | undefined;
  resolveTrack(artist: string, album: string, title: string): Track | null;
  getTracksByGenre(genre: string): Track[];
  getRecentlyAddedTracks(limit?: number): Track[];

  getTrackByIdWithCover(id: number): TrackWithRelations | undefined;
  getAllTracksWithCover(
    sort?: string,
    limit?: number,
    offset?: number,
  ): TrackWithRelations[];
  getRecentlyAddedTracksWithCover(limit?: number): TrackWithRelations[];
  getTracksByGenreWithCover(genre: string): TrackWithRelations[];
}

class TrackServiceImpl implements TrackService {
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

    const dbArtist = dbTrack.artist_id
      ? artistsDb.getById(dbTrack.artist_id)
      : undefined;
    const dbAlbum = dbTrack.album_id
      ? albumsDb.getById(dbTrack.album_id)
      : undefined;

    return mapDbTrackToTrack(dbTrack, dbArtist, dbAlbum);
  }

  public getTracksByAlbum(albumId: number): TrackWithRelations[] {
    const album = albumsDb.getById(albumId);
    if (!album) throw new Error("Album not found");

    return tracksDb.getByAlbumWithRelations(albumId).map((dbTrack) => ({
      ...dbTrack,
      cover_path: album.cover_path ?? "",
      album_name: album.title,
      artist_name: dbTrack.artist.name ?? album.artist_name ?? "",
      genre: dbTrack.genre ?? album.genre ?? undefined,
    }));
  }

  public getTracksByArtist(artistId: number): TrackWithRelations[] {
    const artist = artistsDb.getById(artistId);
    if (!artist) throw new Error("Artist not found");

    return tracksDb
      .getByArtist(artistId)
      .map((dbTrack) => mapDbTrackToTrack(dbTrack, artist));
  }

  public getAllTracks(
    sort?: string,
    limit?: number,
    offset?: number,
  ): TrackWithRelations[] {
    const dbTracks = tracksDb.getAll({ sort, limit, offset });
    return dbTracks.map((dbTrack) => {
      const artist = dbTrack.artist_id
        ? artistsDb.getById(dbTrack.artist_id)
        : undefined;
      const album = dbTrack.album_id
        ? albumsDb.getById(dbTrack.album_id) // Replace with service call?
        : undefined;
      return mapDbTrackToTrack(dbTrack, artist, album);
    });
  }

  public getTrackCount(): number {
    return tracksDb.count();
  }

  public getTrackById(id: number): TrackWithRelations | undefined {
    const dbTrack = tracksDb.getById(id);
    if (!dbTrack) return undefined;

    const artist = dbTrack.artist_id
      ? artistsDb.getById(dbTrack.artist_id)
      : undefined;
    const album = dbTrack.album_id
      ? albumsDb.getById(dbTrack.album_id)
      : undefined;
    return mapDbTrackToTrack(dbTrack, artist, album);
  }
}

export const trackService: TrackService = new TrackServiceImpl();
