export * from "./schemas";
export { PlayTrackError } from "./errors";
export type {
  MPDTrack,
  MPDQueuedTrack,
  MPDEntity,
  MPDEntityType,
} from "./mpdTypes";
export type {
  DBTrack,
  DBAlbum,
  DBArtist,
  DBGenre,
  DBPlaylist,
  DBStorageSource,
  DBSetupProgress,
} from "./dbTypes";
import type {
  DBAlbum,
  DBArtist,
  DBGenre,
  DBTrack,
  DBPlaylist,
  DBStorageSource,
  DBSetupProgress,
} from "./dbTypes";

export type Track = DBTrack & {
  cover_path: string;
  artist_name: string;
  album_name?: string;
  genre?: string;
};
export type Artist = DBArtist & {
  coverPreviews?: string[];
};
// The API joins the artist name onto every album row (AlbumWithArtist in
// @repo/db), so the public Album keeps artist_name even though the albums
// table no longer stores it.
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
export type StorageSource = DBStorageSource;
export type SetupProgress = DBSetupProgress;

export type PlaybackState = "play" | "pause" | "stop";
export type OutputMode = "mpd" | "browser";

export type NetworkStatus = {
  connected: boolean;
  dnsReachable: boolean;
};

export type PlaybackStatus = {
  state: PlaybackState;
  elapsed: number;
  duration: number;
  volume: number;
  repeat: boolean;
  random: boolean;
  single: boolean;
  consume: boolean;
  track?: Track;
  queueLength: number;
};

export type QueuedTrack = {
  id: number;
  file: string;
  title: string;
  artist_name: string;
  album: string;
  duration: number;
  pos: number;
  mpdId: number;
  cover_path: string;
};

export type SearchResults = {
  artists: Artist[];
  albums: Album[];
  tracks: Track[];
};

export type PlayTrackResponse = { success: boolean };

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
