import { Track } from "@repo/types";

import { albumsDb, artistsDb, tracksDb } from "@repo/db";
import { mapDbTrackToTrack } from "../utils/utils";

interface TrackService {
  getTracksByAlbum(albumId: number): Promise<Track[]>;
  getTracksByArtist(artistId: number): Promise<Track[]>;
  getAllTracks(
    sort?: string,
    limit?: number,
    offset?: number,
  ): Promise<Track[]>;
  getTrackCount(): Promise<number>;
  getTrackById(id: number): Promise<Track | undefined>;
  resolveTrack(
    artist: string,
    album: string,
    title: string,
  ): Promise<Track | null>;
  getTracksByGenre(genre: string): Promise<Track[]>;
  getRecentlyAddedTracks(limit?: number): Promise<Track[]>;
}

class TrackServiceImpl implements TrackService {
  public async getRecentlyAddedTracks(limit = 20): Promise<Track[]> {
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

  public async getTracksByGenre(genre: string): Promise<Track[]> {
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
  public async resolveTrack(
    artist: string,
    album: string,
    title: string,
  ): Promise<Track | null> {
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

  public async getTracksByAlbum(albumId: number): Promise<Track[]> {
    const album = albumsDb.getById(albumId);
    if (!album) throw new Error("Album not found");

    return (await tracksDb.getByAlbum(albumId)).map((dbTrack) => {
      const trackArtist = dbTrack.artist_id
        ? artistsDb.getById(dbTrack.artist_id)
        : undefined;
      return mapDbTrackToTrack(dbTrack, trackArtist, album);
    });
  }

  public async getTracksByArtist(artistId: number): Promise<Track[]> {
    const artist = artistsDb.getById(artistId);
    if (!artist) throw new Error("Artist not found");

    return (await tracksDb.getByArtist(artistId)).map((dbTrack) =>
      mapDbTrackToTrack(dbTrack, artist),
    );
  }

  public async getAllTracks(
    sort?: string,
    limit?: number,
    offset?: number,
  ): Promise<Track[]> {
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

  public async getTrackCount(): Promise<number> {
    return tracksDb.count();
  }

  public async getTrackById(id: number): Promise<Track | undefined> {
    const dbTrack = await tracksDb.getById(id);
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
