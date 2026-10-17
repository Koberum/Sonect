import { useTranslation } from "react-i18next";
import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import { AlbumArtwork } from "@/features/dashboard/components/album-artwork";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SortTabs } from "@/features/dashboard/components/sort-tabs";
import { Disc3 } from "lucide-react";

type SortOption = "title" | "year" | "recent";

export default function Albums() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>("title");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery(catalogQueries.albumsInfinite(sort));

  const albums = data?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, sort]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "title", label: t("albums.sortTitle") },
    { value: "year", label: t("albums.sortYear") },
    { value: "recent", label: t("albums.sortRecent") },
  ];

  return (
    <div>
      <PageHeader
        title={t("albums.title")}
        description={t("albums.description")}
      />
      <SortTabs
        value={sort}
        onValueChange={setSort}
        options={sortOptions}
        className="mb-4"
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {isPending ? (
          Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))
        ) : albums.length === 0 ? (
          <div className="col-span-full">
            <EmptyState icon={Disc3} title={t("albums.noAlbums")} />
          </div>
        ) : (
          albums.map((album) => (
            <AlbumArtwork
              key={album.id}
              album={album}
              aspectRatio="square"
              className="w-full"
              onClick={() => navigate(`/albums/${album.id}`)}
            />
          ))
        )}
      </div>
      <div ref={sentinelRef} className="h-4" />
      {isFetchingNextPage && (
        <Skeleton className="mt-2 h-12 w-full rounded-lg" />
      )}
    </div>
  );
}
