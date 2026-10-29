export { PlayTrackError } from "./errors";
export type { MPDTrack, MPDQueuedTrack, MPDEntity, MPDEntityType } from "./mpd";
export type {
  DBTrack,
  DBAlbum,
  DBArtist,
  DBGenre,
  DBPlaylist,
  DBStorageSource,
  DBTrackWithRelations,
} from "./db";
import type { DBStorageSource } from "./db";
import { TrackWithRelations } from "./catalog";

export type StorageSource = DBStorageSource;

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
  error?: string | null;
  track?: TrackWithRelations;
  queueLength: number;
  activeDeviceId?: string | null;
  activeDeviceName?: string | null;
  activeDeviceType?: string | null;
  mode?: OutputMode;
  nextTrackId?: number | null;
  buffering?: boolean;
  seekSeq?: number;
  crossfade?: number;
};

export type PlaybackSettings = {
  crossfadeSeconds: number;
};


/**
 * Playback facts reported by the active browser engine. The browser is the
 * source of truth for timing in browser mode, so the backend mirrors these
 * values instead of running its own clock.
 */
export type PlayerReport = {
  state?: PlaybackState;
  elapsed?: number;
  event?: "playing" | "paused" | "ended" | "advance" | "waiting";
  trackId?: number;
};

export type QueuedTrack = {
  id: number;
  trackId: number | null;
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

export type SessionQueueEntry = {
  id: number;
  file: string;
  title: string;
  artist_name: string;
  album: string;
  duration: number;
  cover_path: string;
};

// Sub-package re-exports for modular imports
export * from "./catalog";
export * from "./mpd";
export * from "./system";
export * from "./db";
export * from "./auth";
export * from "./schemas";
export * from "./errors";
