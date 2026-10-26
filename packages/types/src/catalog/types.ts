import {
  DBTrack,
  DBAlbum,
  DBArtist,
  DBGenre,
  DBGenreWithCounts,
  DBPlaylist,
  DBTrackWithRelations,
} from "../db/types";
import type { MPDTrack } from "../mpd/types";

export type CatalogTrack = MPDTrack & {
  storageSourceId?: number | null;
};

export type LibrarySyncPhase = "scan-started" | "mpd" | "tracks" | "covers";

export type LibrarySyncProgress = {
  phase: LibrarySyncPhase;
  current: number;
  total: number;
  track: { title: string; artist: string; album: string } | null;
};

export type CoverProgress = {
  current: number;
  total: number;
  album: {
    id: number;
    title: string;
    artist: string;
  };
};

export type Track = DBTrack;
export type TrackWithRelations = DBTrackWithRelations;
export type Artist = DBArtist & {
  coverPreviews?: string[];
};

export type Album = DBAlbum & {
  artist_name: string;
  genre?: string;
};

export type Genre = DBGenre;
export type GenreWithCounts = DBGenreWithCounts;
export type Playlist = DBPlaylist;
export type PlaylistTrack = TrackWithRelations & { pt_id: number };
export type PlaylistWithTracks = Playlist & {
  tracks: PlaylistTrack[];
};

export interface DashboardData {
  continueListening: Album[];
  recentlyPlayed: TrackWithRelations[];
  topTracks: TrackWithRelations[];
  suggestedTracks: TrackWithRelations[];
  genreQuickMix: {
    genre: string;
    tracks: TrackWithRelations[];
  } | null;
}

export type SearchResults = {
  artists: Artist[];
  albums: Album[];
  tracks: TrackWithRelations[];
};

export interface LikedTracksPage {
  items: TrackWithRelations[];
  total: number;
  totalDuration: number;
}

export interface LibraryStats {
  totalTracks: number;
  totalArtists: number;
  totalAlbums: number;
  totalPlaylists: number;
  totalGenres: number;
  totalDuration: number;
  averageDuration: number;
  earliestYear: number | null;
  latestYear: number | null;
  tracksWithoutAlbum: number;
  lastSync: string | null;
}
