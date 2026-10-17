import type * as mm from "music-metadata";
import type { MPDTrack } from "@repo/types/mpd";

export interface AudioMetadataInput {
  file: string;
  mtimeMs: number;
  size: number;
  common?: mm.ICommonTagsResult;
  format?: mm.IFormat;
}

export function mapAudioMetadata(
  input: AudioMetadataInput,
  fallbackTitle: string,
): MPDTrack {
  const { file, mtimeMs, size, common, format } = input;

  return {
    file,
    title: common?.title ?? fallbackTitle,
    artist: common?.artist ?? common?.artists?.[0],
    albumArtist: common?.albumartist,
    album: common?.album,
    genre: common?.genre?.[0],
    track: common?.track?.no ?? undefined,
    disc: common?.disk?.no?.toString(),
    date: common?.date ?? common?.year?.toString(),
    duration: format?.duration ?? undefined,
    mtime: mtimeMs,
    size,
  };
}
