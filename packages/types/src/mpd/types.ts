/**
 * MPD Client Types
 */

export type MPDTrack = {
  file: string;
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
  lastModified?: string;
  mtime?: number;
  size?: number;
};
