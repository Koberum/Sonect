import { albumsDb, tracksDb } from "@repo/db";
import type { DashboardData, Album, Track } from "@repo/types/catalog";

export interface SuggestionServiceInterface {
  getDashboard(currentAlbumId?: number): DashboardData;
}

export class SuggestionService implements SuggestionServiceInterface {
  getDashboard(currentAlbumId?: number): DashboardData {
    const continueListening = this._getContinueListening(currentAlbumId);
    const recentlyPlayed = this._getRecentlyPlayed();
    const topTracks = this._getTopTracks();
    const suggestedTracks = this._getSuggestedTracks();
    const genreQuickMix = this._getGenreQuickMix();

    return {
      continueListening,
      recentlyPlayed,
      topTracks,
      suggestedTracks,
      genreQuickMix,
    };
  }

  private _getContinueListening(excludeAlbumId?: number): Album[] {
    const albums = albumsDb.getRecentAlbums(10, excludeAlbumId);
    return albums as Album[];
  }

  private _getRecentlyPlayed(): Track[] {
    const tracks = tracksDb.getRecentlyPlayed(20);
    return tracks as unknown as Track[];
  }

  private _getTopTracks(): Track[] {
    const tracks = tracksDb.getTopTracks(10);
    return tracks as unknown as Track[];
  }

  private _getSuggestedTracks(): Track[] {
    const genres = tracksDb.getTopGenres(3);
    const artists = tracksDb.getTopArtists(3);
    const artistIds = artists.map((a) => a.id);
    const tracks = tracksDb.getTracksForDiscovery(genres, artistIds, 10);
    return tracks as unknown as Track[];
  }

  private _getGenreQuickMix(): {
    genre: string;
    tracks: Track[];
  } | null {
    const topGenre = tracksDb.getTopGenre();
    if (!topGenre) return null;
    const tracks = tracksDb.getTracksByGenre(
      topGenre,
      25,
    ) as unknown as Track[];
    for (let i = tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
    }
    return { genre: topGenre, tracks };
  }
}
