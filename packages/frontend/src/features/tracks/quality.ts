import type { AudioQuality, TrackWithRelations } from "@repo/types/catalog";
import i18n from "@/i18n/config";

export type QualitySort = "none" | "desc" | "asc";

export type QualityOption = {
  key: string;
  label: string;
};

function locale(): string {
  return i18n.resolvedLanguage ?? "en";
}

export function formatSampleRate(rate: number): string {
  const value = new Intl.NumberFormat(locale(), {
    maximumFractionDigits: 1,
  }).format(rate / 1000);
  return `${value} kHz`;
}

export function formatBitDepth(bits: number): string {
  return `${bits} bit`;
}

export function qualityKeyFromValues(
  bitsPerSample: number | null | undefined,
  sampleRate: number | null | undefined,
): string | null {
  if (bitsPerSample == null && sampleRate == null) return null;
  return `${bitsPerSample ?? ""}:${sampleRate ?? ""}`;
}

/** Stable filter key: bits:sampleRate, with an empty side for a null value. */
export function qualityKey(track: TrackWithRelations): string | null {
  return qualityKeyFromValues(track.bits_per_sample, track.sample_rate);
}

export function hasQualityData(track: TrackWithRelations): boolean {
  return qualityKey(track) !== null;
}

export function formatQualityFromValues(
  bitsPerSample: number | null | undefined,
  sampleRate: number | null | undefined,
): string | null {
  const parts: string[] = [];
  if (sampleRate != null) parts.push(formatSampleRate(sampleRate));
  if (bitsPerSample != null) parts.push(formatBitDepth(bitsPerSample));
  return parts.length > 0 ? parts.join(" / ") : null;
}

export function formatQuality(track: TrackWithRelations): string | null {
  return formatQualityFromValues(track.bits_per_sample, track.sample_rate);
}

export function fileExtension(file: string): string | undefined {
  const name = file.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return undefined;
  return name.slice(dot + 1).toUpperCase();
}

function compareQuality(
  aBits: number | null | undefined,
  aRate: number | null | undefined,
  bBits: number | null | undefined,
  bRate: number | null | undefined,
  direction: "desc" | "asc",
): number {
  const bitsA = aBits ?? null;
  const bitsB = bBits ?? null;
  const rateA = aRate ?? null;
  const rateB = bRate ?? null;

  if (bitsA === null && bitsB !== null) return 1;
  if (bitsA !== null && bitsB === null) return -1;
  if (bitsA !== null && bitsB !== null && bitsA !== bitsB) {
    return direction === "desc" ? bitsB - bitsA : bitsA - bitsB;
  }

  if (rateA === null && rateB !== null) return 1;
  if (rateA !== null && rateB === null) return -1;
  if (rateA !== null && rateB !== null && rateA !== rateB) {
    return direction === "desc" ? rateB - rateA : rateA - rateB;
  }

  return 0;
}

export function qualityOptionsFromTracks(
  tracks: TrackWithRelations[],
): QualityOption[] {
  const options = new Map<
    string,
    { option: QualityOption; bits: number | null; rate: number | null }
  >();

  for (const track of tracks) {
    const key = qualityKey(track);
    if (!key || options.has(key)) continue;
    const label = formatQuality(track);
    if (!label) continue;
    options.set(key, {
      option: { key, label },
      bits: track.bits_per_sample ?? null,
      rate: track.sample_rate ?? null,
    });
  }

  return [...options.values()]
    .sort(
      (a, b) =>
        compareQuality(a.bits, a.rate, b.bits, b.rate, "desc") ||
        a.option.key.localeCompare(b.option.key),
    )
    .map((entry) => entry.option);
}

export function qualityOptionsFromQualities(
  qualities: AudioQuality[],
): QualityOption[] {
  return qualities.flatMap((quality) => {
    const key = qualityKeyFromValues(
      quality.bits_per_sample,
      quality.sample_rate,
    );
    const label = formatQualityFromValues(
      quality.bits_per_sample,
      quality.sample_rate,
    );
    return key && label ? [{ key, label }] : [];
  });
}

export function filterAndSortTracks<T extends TrackWithRelations>(
  tracks: T[],
  filter: string | null,
  sort: QualitySort,
): T[] {
  const filtered =
    filter === null
      ? tracks
      : tracks.filter((track) => qualityKey(track) === filter);

  if (sort === "none") return filtered;

  return filtered
    .map((track, index) => ({ track, index }))
    .sort(
      (a, b) =>
        compareQuality(
          a.track.bits_per_sample,
          a.track.sample_rate,
          b.track.bits_per_sample,
          b.track.sample_rate,
          sort,
        ) || a.index - b.index,
    )
    .map((entry) => entry.track);
}
