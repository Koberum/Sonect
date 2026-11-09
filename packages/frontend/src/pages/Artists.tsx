import { ArtistCard } from "@/features/catalog/components/media-card/artist-card";
import { MediaGrid } from "@/features/catalog/components/media-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";
import { useInfiniteQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { UserRound } from "lucide-react";

export function Artists() {
  const { t } = useTranslation();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    refetch,
  } = useInfiniteQuery(catalogQueries.artistsInfinite());

  const artists = data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  return (
    <div>
      <MediaGrid>
        {isPending ? (
          Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))
        ) : isError ? (
          <div className="col-span-full">
            <QueryError
              message={t("common.loadError")}
              onRetry={() => void refetch()}
            />
          </div>
        ) : artists.length === 0 ? (
          <div className="col-span-full">
            <EmptyState icon={UserRound} title={t("artists.noArtists")} />
          </div>
        ) : (
          artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} className="w-full" />
          ))
        )}
      </MediaGrid>
      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && (
        <Skeleton className="mt-2 h-12 w-full rounded-lg" />
      )}
    </div>
  );
}
