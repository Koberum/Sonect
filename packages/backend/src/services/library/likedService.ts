import {
  likedDb,
  tracksDb,
  type LikedQualityFilter,
  type LikedSort,
  type LikedSummary,
} from "@repo/db";
import type { LikedTracksPage } from "@repo/types/catalog";

export type LikedServiceListOptions = {
  limit?: number;
  offset?: number;
  quality?: LikedQualityFilter;
  sort?: LikedSort;
};

export function parseQualityKey(
  value: string | undefined,
): LikedQualityFilter | undefined {
  if (!value) return undefined;
  const [bitsPart, ratePart] = value.split(":");
  if (bitsPart === undefined || ratePart === undefined) return undefined;
  return {
    bitsPerSample: bitsPart === "" ? null : Number(bitsPart),
    sampleRate: ratePart === "" ? null : Number(ratePart),
  };
}

export interface LikedService {
  list(profileId: string, options?: LikedServiceListOptions): LikedTracksPage;
  ids(profileId: string): number[];
  files(
    profileId: string,
    quality?: LikedQualityFilter,
    sort?: LikedSort,
  ): string[];
  add(profileId: string, trackId: number): boolean | undefined;
  remove(profileId: string, trackId: number): boolean;
  summary(profileId: string, quality?: LikedQualityFilter): LikedSummary;
}

export class LikedServiceImpl implements LikedService {
  list(
    profileId: string,
    options: LikedServiceListOptions = {},
  ): LikedTracksPage {
    const summary = likedDb.summary(profileId, options.quality);
    return {
      items: likedDb.list(profileId, options),
      total: summary.count,
      totalDuration: summary.totalDuration,
      qualities: likedDb.qualities(profileId),
    };
  }

  ids(profileId: string): number[] {
    return likedDb.ids(profileId);
  }

  files(
    profileId: string,
    quality?: LikedQualityFilter,
    sort?: LikedSort,
  ): string[] {
    return likedDb.files(profileId, quality, sort);
  }

  add(profileId: string, trackId: number): boolean | undefined {
    if (!tracksDb.getById(trackId)) return undefined;
    return likedDb.add(profileId, trackId);
  }

  remove(profileId: string, trackId: number): boolean {
    return likedDb.remove(profileId, trackId);
  }

  summary(profileId: string, quality?: LikedQualityFilter): LikedSummary {
    return likedDb.summary(profileId, quality);
  }
}
