import { ArtistArtwork } from "@/features/dashboard/components/artist-artwork";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import { UserRound } from "lucide-react";

export function Artists() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery(catalogQueries.artistsInfinite());

  const artists = data?.pages.flatMap((p) => p.items) ?? [];

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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div>
      <PageHeader
        title={t("artists.title")}
        description={t("artists.description")}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {isPending ? (
          Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))
        ) : artists.length === 0 ? (
          <div className="col-span-full">
            <EmptyState icon={UserRound} title={t("artists.noArtists")} />
          </div>
        ) : (
          artists.map((artist) => (
            <ArtistArtwork
              key={artist.id}
              artist={artist}
              aspectRatio="square"
              className="w-full"
              onClick={() => navigate(`/artists/${artist.id}/albums`)}
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
