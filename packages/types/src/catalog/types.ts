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
  recentlyPlayedAlbums: Album[];
  recentlyPlayedArtists: Artist[];
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

export interface TrackInfo {
  id: number;
  title: string;
  file: string;
  absolutePath: string | null;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  genre: string | null;
  year: number | null;
  date: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  duration: number | null;
  size: number | null;
  mtime: number | null;
  storageSource: {
    id: number;
    name: string;
    path: string;
  } | null;
  playCount: number;
  lastPlayed: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
