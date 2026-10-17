import { AlbumArtwork } from "@/features/dashboard/components/album-artwork";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SortTabs } from "@/features/dashboard/components/sort-tabs";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import { Disc3 } from "lucide-react";

type SortOption = "title" | "year" | "recent";

export function ArtistAlbums() {
  const { t } = useTranslation();
  const { artistId } = useParams();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>("year");

  const { data: albums = [], isPending: albumsPending } = useQuery({
    ...catalogQueries.albumsByArtist(artistId ?? ""),
    enabled: !!artistId,
  });
  const { data: artist, isPending: artistPending } = useQuery({
    ...catalogQueries.artist(artistId ?? ""),
    enabled: !!artistId,
  });

  const isPending = albumsPending || artistPending;

  const sortedAlbums = [...(albums ?? [])].sort((a, b) => {
    if (sort === "title") return (a.title ?? "").localeCompare(b.title ?? "");
    if (sort === "year") return (b.year ?? 0) - (a.year ?? 0);
    return 0;
  });

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "title", label: t("albums.sortTitle") },
    { value: "year", label: t("albums.sortYear") },
    { value: "recent", label: t("albums.sortRecent") },
  ];

  return (
    <div>
      <PageHeader
        title={artist ? artist.name : t("artist.loading")}
        description={t("artist.description")}
      />
      {isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <SortTabs
            value={sort}
            onValueChange={setSort}
            options={sortOptions}
            className="mb-4"
          />
          {sortedAlbums.length === 0 ? (
            <EmptyState icon={Disc3} title={t("albums.noAlbums")} />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
              {sortedAlbums.map((album) => (
                <AlbumArtwork
                  key={album.id}
                  album={album}
                  aspectRatio="square"
                  className="w-full"
                  onClick={() => navigate(`/albums/${album.id}`)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
