import {
  DBTrack,
  DBAlbum,
  DBArtist,
  DBGenre,
  DBPlaylist,
  DBTrackWithRelations,
} from "../dbTypes";

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
export type Playlist = DBPlaylist;
export type PlaylistTrack = Track & { pt_id: number };
export type PlaylistWithTracks = Playlist & {
  tracks: PlaylistTrack[];
};

export interface DashboardData {
  continueListening: Album[];
  recentlyPlayed: Track[];
  topTracks: Track[];
  suggestedTracks: Track[];
  genreQuickMix: {
    genre: string;
    tracks: Track[];
  } | null;
}

export type SearchResults = {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
};

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

