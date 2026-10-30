import { albumsDb, playHistoryDb, tracksDb } from "@repo/db";
import type { DashboardData, Album, Artist, Track } from "@repo/types/catalog";

export interface SuggestionServiceInterface {
  getDashboard(profileId: string, currentAlbumId?: number): DashboardData;
}

export class SuggestionService implements SuggestionServiceInterface {
  getDashboard(profileId: string, currentAlbumId?: number): DashboardData {
    const recentlyPlayedAlbums = this._getRecentlyPlayedAlbums(
      profileId,
      currentAlbumId,
    );
    const recentlyPlayedArtists = this._getRecentlyPlayedArtists(profileId);
    const recentlyPlayed = this._getRecentlyPlayed(profileId);
    const topTracks = this._getTopTracks(profileId);
    const suggestedTracks = this._getSuggestedTracks(profileId);
    const genreQuickMix = this._getGenreQuickMix(profileId);

    return {
      recentlyPlayedAlbums,
      recentlyPlayedArtists,
      recentlyPlayed,
      topTracks,
      suggestedTracks,
      genreQuickMix,
    };
  }

  private _getRecentlyPlayedAlbums(
    profileId: string,
    excludeAlbumId?: number,
  ): Album[] {
    return playHistoryDb.recentAlbums(profileId, 10, excludeAlbumId);
  }

  private _getRecentlyPlayedArtists(profileId: string, limit = 10): Artist[] {
    return playHistoryDb.recentArtists(profileId, limit).map((artist) => ({
      ...artist,
      coverPreviews: albumsDb.getCoverPreviews(artist.id, 4),
    }));
  }

  private _getRecentlyPlayed(profileId: string): Track[] {
    return playHistoryDb.recentTracks(profileId, 20) as unknown as Track[];
  }

  private _getTopTracks(profileId: string): Track[] {
    return playHistoryDb.topTracks(profileId, 10) as unknown as Track[];
  }

  private _getSuggestedTracks(profileId: string): Track[] {
    const genres = playHistoryDb.topGenres(profileId, 3);
    const artists = playHistoryDb.topArtists(profileId, 3);
    const artistIds = artists.map((artist) => artist.id);
    const discovered = playHistoryDb.discoveryTracks(
      profileId,
      genres,
      artistIds,
      10,
    );
    const tracks =
      discovered.length > 0
        ? discovered
        : tracksDb.getRandomWithRelations(10);
    return tracks as unknown as Track[];
  }

  private _getGenreQuickMix(profileId: string): {
    genre: string;
    tracks: Track[];
  } | null {
    const topGenre =
      playHistoryDb.topGenre(profileId) ?? tracksDb.getMostCommonGenre();
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
