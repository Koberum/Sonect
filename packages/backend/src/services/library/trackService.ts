import { Track, TrackWithCover } from "@repo/types/library";
import { albumsDb, artistsDb, tracksDb } from "@repo/db";

interface TrackService {
  getTracksByAlbum(albumId: number): Track[];
  getTracksByArtist(artistId: number): Track[];
  getAllTracks(sort?: string, limit?: number, offset?: number): Track[];
  getTrackCount(): number;
  getTrackById(id: number): Track | undefined;
  resolveTrack(artist: string, album: string, title: string): Track | null;
  getTracksByGenre(genre: string): Track[];
  getRecentlyAddedTracks(limit?: number): Track[];

  getTrackByIdWithCover(id: number): TrackWithCover | undefined;
  getTracksByAlbumWithCover(albumId: number): TrackWithCover[];
  getTracksByArtistWithCover(artistId: number): TrackWithCover[];
  getAllTracksWithCover(
    sort?: string,
    limit?: number,
    offset?: number,
  ): TrackWithCover[];
  getRecentlyAddedTracksWithCover(limit?: number): TrackWithCover[];
  getTracksByGenreWithCover(genre: string): TrackWithCover[];
}

class TrackServiceImpl implements TrackService {
  public getRecentlyAddedTracks(limit = 20): Track[] {
    const dbTracks = tracksDb.getRecent(limit);
    return dbTracks.map((dbTrack) => {
      const artist = dbTrack.artist_id
        ? artistsDb.getById(dbTrack.artist_id)
        : undefined;
      const album = dbTrack.album_id
        ? albumsDb.getById(dbTrack.album_id)
        : undefined;
      return mapDbTrackToTrack(dbTrack, artist, album);
    });
  }

  public getTracksByGenre(genre: string): Track[] {
    const dbTracks = tracksDb.getByGenre(genre);
    return dbTracks.map((dbTrack) => {
      const artist = dbTrack.artist_id
        ? artistsDb.getById(dbTrack.artist_id)
        : undefined;
      const album = dbTrack.album_id
        ? albumsDb.getById(dbTrack.album_id)
        : undefined;
      return mapDbTrackToTrack(dbTrack, artist, album);
    });
  }
  public resolveTrack(
    artist: string,
    album: string,
    title: string,
  ): Track | null {
    const dbTrack = await tracksDb.getByArtistAlbumTitle(artist, album, title);
    if (!dbTrack) return null;

    const dbArtist = dbTrack.artist_id
      ? await artistsDb.getById(dbTrack.artist_id)
      : undefined;
    const dbAlbum = dbTrack.album_id
      ? await albumsDb.getById(dbTrack.album_id)
      : undefined;

    return mapDbTrackToTrack(dbTrack, dbArtist, dbAlbum);
  }

  public getTracksByAlbum(albumId: number): Track[] {
    const album = albumsDb.getById(albumId);
    if (!album) throw new Error("Album not found");

    return tracksDb.getByAlbum(albumId).map((dbTrack) => {
      const trackArtist = dbTrack.artist_id
        ? artistsDb.getById(dbTrack.artist_id)
        : undefined;
      return mapDbTrackToTrack(dbTrack, trackArtist, album);
    });
  }

  public getTracksByArtist(artistId: number): Track[] {
    const artist = artistsDb.getById(artistId);
    if (!artist) throw new Error("Artist not found");

    return tracksDb
      .getByArtist(artistId)
      .map((dbTrack) => mapDbTrackToTrack(dbTrack, artist));
  }

  public getAllTracks(sort?: string, limit?: number, offset?: number): Track[] {
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

  public getTrackById(id: number): Track | undefined {
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

  public getTracksByAlbum(albumId: number): TrackWithCover[] {
    const album = albumsDb.getById(albumId);
    if (!album) throw new Error("Album not found");

    return tracksDb.getByAlbum(albumId).map((dbTrack) => ({
      ...dbTrack,
      cover_path: album.cover_path ?? "",
      album_name: album.title,
      artist_name: dbTrack.artist_name ?? album.artist_name ?? "",
      genre: dbTrack.genre ?? album.genre ?? undefined,
    }));
  }
}

export const trackService: TrackService = new TrackServiceImpl();
