import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { QualitySort } from "@/features/tracks/quality";
import { qk } from "@/lib/queryKeys";
import { getLiked, getLikedIds } from "./api";

export const LIKED_PAGE_SIZE = 100;

function apiSort(sort: QualitySort): string | undefined {
  if (sort === "desc") return "quality-desc";
  if (sort === "asc") return "quality-asc";
  return undefined;
}

export const likedQueries = {
  ids: (profileId: string) =>
    queryOptions({
      queryKey: qk.liked.ids(profileId),
      queryFn: ({ signal }) => getLikedIds(signal).then((data) => data.ids),
      enabled: !!profileId,
      staleTime: 30_000,
    }),

  list: (
    profileId: string,
    quality: string | null = null,
    sort: QualitySort = "none",
  ) =>
    infiniteQueryOptions({
      queryKey: qk.liked.list(profileId, quality, sort),
      queryFn: ({ pageParam, signal }) =>
        getLiked(
          {
            limit: LIKED_PAGE_SIZE,
            offset: pageParam as number,
            quality,
            sort: apiSort(sort),
          },
          signal,
        ),
      initialPageParam: 0,
      getNextPageParam: (last, allPages) => {
        if (last.items.length < LIKED_PAGE_SIZE) return undefined;
        return allPages.reduce((acc, page) => acc + page.items.length, 0);
      },
      enabled: !!profileId,
      staleTime: 30_000,
    }),
};
