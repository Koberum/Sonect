/**
 *
 * MPD Client Types
 */

export type MPDTrack = {
  file: string;
  lastModified?: string;
  format?: string;
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  track?: number;
  date?: string;
  disc?: string;
  duration?: number;
};

export type MPDQueuedTrack = MPDTrack & {
  pos: number;
  id: number;
};

export type MPDEntityType =
  "file" | "directory" | "playlist" | "song" | "generic";

export interface MPDEntity {
  type: MPDEntityType;
  [key: string]: string | number | boolean | undefined;
}
