export * from "./schemas";
export { PlayTrackError } from "./errors";
export type { MPDTrack, MPDQueuedTrack, MPDEntity, MPDEntityType } from "./mpd";
export type {
  DBTrack,
  DBAlbum,
  DBArtist,
  DBGenre,
  DBPlaylist,
  DBStorageSource,
  DBSetupProgress,
  DBTrackWithRelations,
} from "./db";
import type { DBStorageSource, DBSetupProgress } from "./db";
import { TrackWithRelations } from "./library";

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
  track?: TrackWithRelations;
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

// Sub-package re-exports for modular imports
export * from "./library";
export * from "./mpd";
export * from "./system";
export * from "./db";
export * from "./schemas";
export * from "./errors";
