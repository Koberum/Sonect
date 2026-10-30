import { likedDb, tracksDb, type LikedSummary } from "@repo/db";
import type { LikedTracksPage } from "@repo/types/catalog";

export interface LikedService {
  list(profileId: string, limit?: number, offset?: number): LikedTracksPage;
  ids(profileId: string): number[];
  files(profileId: string): string[];
  add(profileId: string, trackId: number): boolean | undefined;
  remove(profileId: string, trackId: number): boolean;
  summary(profileId: string): LikedSummary;
}

export class LikedServiceImpl implements LikedService {
  list(profileId: string, limit?: number, offset?: number): LikedTracksPage {
    const summary = likedDb.summary(profileId);
    return {
      items: likedDb.list(profileId, { limit, offset }),
      total: summary.count,
      totalDuration: summary.totalDuration,
    };
  }

  ids(profileId: string): number[] {
    return likedDb.ids(profileId);
  }

  files(profileId: string): string[] {
    return likedDb.files(profileId);
  }

  add(profileId: string, trackId: number): boolean | undefined {
    if (!tracksDb.getById(trackId)) return undefined;
    return likedDb.add(profileId, trackId);
  }

  remove(profileId: string, trackId: number): boolean {
    return likedDb.remove(profileId, trackId);
  }

  summary(profileId: string): LikedSummary {
    return likedDb.summary(profileId);
  }
}
