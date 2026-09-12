import {
  DBTrack,
  DBAlbum,
  DBArtist,
  DBGenre,
  DBPlaylist,
  DBTrackWithRelations,
} from "../db/types";

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
