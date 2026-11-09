import { apiFetch } from "@/lib/api";
import type { LikedTracksPage } from "@repo/types/catalog";

export type LikedListParams = {
  limit?: number;
  offset?: number;
  quality?: string | null;
  sort?: string;
};

export function getLiked(
  params: LikedListParams = {},
  signal?: AbortSignal,
): Promise<LikedTracksPage> {
  return apiFetch("/likes", {
    params: {
      limit: params.limit,
      offset: params.offset,
      quality: params.quality,
      sort: params.sort,
    },
    signal,
  });
}

export function getLikedIds(signal?: AbortSignal): Promise<{ ids: number[] }> {
  return apiFetch("/likes/ids", { signal });
}

export function likeTrack(trackId: number): Promise<{ liked: boolean }> {
  return apiFetch(`/likes/${trackId}`, { method: "PUT" });
}

export function unlikeTrack(trackId: number): Promise<{ liked: boolean }> {
  return apiFetch(`/likes/${trackId}`, { method: "DELETE" });
}

export function playLiked(
  shuffle = false,
  quality: string | null = null,
  sort?: string,
): Promise<{ started: boolean; count: number }> {
  return apiFetch("/likes/play", {
    method: "POST",
    body: { shuffle, quality: quality ?? undefined, sort },
  });
}
