import type { Album, TrackWithRelations } from "@repo/types/catalog";

export type AlbumMetadata = {
  year?: number;
  trackCount: number;
  totalDuration: number;
  genre?: string;
  formats: string[];
  sourceNames: string[];
};

function parseYear(value: string | undefined): number | undefined {
  const match = value?.match(/\b(\d{4})\b/);
  if (!match) return undefined;
  const year = Number(match[1]);
  return Number.isFinite(year) && year > 0 ? year : undefined;
}

function fileExtension(file: string): string | undefined {
  const name = file.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return undefined;
  return name.slice(dot + 1).toUpperCase();
}

export function deriveAlbumMetadata(
  album: Album | undefined,
  tracks: TrackWithRelations[],
): AlbumMetadata {
  const trackYears = tracks
    .map((track) => parseYear(track.date))
    .filter((year): year is number => year !== undefined);

  const genres = tracks
    .map((track) => track.genre?.trim())
    .filter((genre): genre is string => Boolean(genre));

  const formats = [
    ...new Set(
      tracks
        .map((track) => fileExtension(track.file))
        .filter((format): format is string => Boolean(format)),
    ),
  ].sort();

  const sourceNames = [
    ...new Set(
      tracks
        .map((track) => track.storage_source_name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    year:
      (album?.year ?? undefined) ||
      (trackYears.length > 0 ? Math.min(...trackYears) : undefined),
    trackCount: tracks.length,
    totalDuration: tracks.reduce(
      (total, track) => total + (track.duration ?? 0),
      0,
    ),
    genre: album?.genre?.trim() || genres[0],
    formats,
    sourceNames,
  };
}

export function formatAlbumDuration(
  totalSeconds: number,
  locale: string,
): string | null {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return null;

  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  const minuteFormat = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "minute",
    unitDisplay: "short",
  });

  if (hours === 0) return minuteFormat.format(minutes);

  const hourFormat = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "hour",
    unitDisplay: "short",
  });

  if (minutes === 0) return hourFormat.format(hours);
  return `${hourFormat.format(hours)} ${minuteFormat.format(minutes)}`;
}
