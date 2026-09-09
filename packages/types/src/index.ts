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
import type { DBStorageSource, DBSetupProgress } from "./dbTypes";
import { Track } from "./library/types";

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

export type PlayTrackResponse = { success: boolean };
