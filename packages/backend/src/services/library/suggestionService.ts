import { albumsDb, tracksDb } from "@repo/db";
import type { DashboardData, Album, Track } from "@repo/types/library";

export class SuggestionService {
  async getDashboard(currentAlbumId?: number): Promise<DashboardData> {
    const [
      continueListening,
      recentlyPlayed,
      topTracks,
      suggestedTracks,
      genreQuickMix,
    ] = await Promise.all([
      this._getContinueListening(currentAlbumId),
      this._getRecentlyPlayed(),
      this._getTopTracks(),
      this._getSuggestedTracks(),
      this._getGenreQuickMix(),
    ]);

    return {
      continueListening,
      recentlyPlayed,
      topTracks,
      suggestedTracks,
      genreQuickMix,
    };
  }

  private _getContinueListening(excludeAlbumId?: number): Promise<Album[]> {
    const albums = albumsDb.getRecentAlbums(10, excludeAlbumId);
    return Promise.resolve(albums as Album[]);
  }

  private _getRecentlyPlayed(): Promise<Track[]> {
    const tracks = tracksDb.getRecentlyPlayed(20);
    return Promise.resolve(tracks as unknown as Track[]);
  }

  private _getTopTracks(): Promise<Track[]> {
    const tracks = tracksDb.getTopTracks(10);
    return Promise.resolve(tracks as unknown as Track[]);
  }

  private async _getSuggestedTracks(): Promise<Track[]> {
    const genres = tracksDb.getTopGenres(3);
    const artists = tracksDb.getTopArtists(3);
    const artistIds = artists.map((a) => a.id);
    const tracks = tracksDb.getTracksForDiscovery(genres, artistIds, 10);
    return tracks as unknown as Track[];
  }

  private _getGenreQuickMix(): Promise<{
    genre: string;
    tracks: Track[];
  } | null> {
    const topGenre = tracksDb.getTopGenre();
    if (!topGenre) return Promise.resolve(null);
    const tracks = tracksDb.getTracksByGenre(
      topGenre,
      25,
    ) as unknown as Track[];
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    return Promise.resolve({ genre: topGenre, tracks });
  }
}
