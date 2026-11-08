import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import { AlbumCard } from "@/features/catalog/components/media-card/album-card";
import { MediaGrid } from "@/features/catalog/components/media-grid";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { SortTabs } from "@/components/ui/sort-tabs";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { Disc3 } from "lucide-react";

type SortOption = "title" | "year" | "recent";

export default function Albums() {
  const { t } = useTranslation();
  const [sort, setSort] = useState<SortOption>("recent");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    refetch,
  } = useInfiniteQuery(catalogQueries.albumsInfinite(sort));

  const albums = data?.pages.flatMap((p) => p.items) ?? [];
  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    resetKey: sort,
  });

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "title", label: t("albums.sortTitle") },
    { value: "year", label: t("albums.sortYear") },
    { value: "recent", label: t("albums.sortRecent") },
  ];

  return (
    <div>
      <SortTabs
        value={sort}
        onValueChange={setSort}
        options={sortOptions}
        className="mb-4"
      />
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
        ) : albums.length === 0 ? (
          <div className="col-span-full">
            <EmptyState icon={Disc3} title={t("albums.noAlbums")} />
          </div>
        ) : (
          albums.map((album) => (
            <AlbumCard key={album.id} album={album} className="w-full" />
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
