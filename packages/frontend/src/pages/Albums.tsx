import { useTranslation } from "react-i18next";
import { getAlbums } from "@/features/apis/libraryApis";
import { usePlaybackContext } from "@/components/playback-context";
import { useEffect, useState, useRef, useCallback } from "react";
import type { Album } from "@repo/types";
import { useNavigate } from "react-router-dom";
import { AlbumArtwork } from "@/features/dashboard/components/album-artwork";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import { SortTabs } from "@/features/dashboard/components/sort-tabs";

type SortOption = "title" | "year" | "recent";
const PAGE_SIZE = 50;

export default function Albums() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePlaybackContext();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [total, setTotal] = useState(0);
  const [firstLoad, setFirstLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortOption>("title");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const needsResetRef = useRef(true);
  const lengthRef = useRef(albums.length);
  const totalRef = useRef(total);

  useEffect(() => {
    lengthRef.current = albums.length;
    totalRef.current = total;
  });

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    if (!needsResetRef.current && albums.length >= total && total > 0) return;
    loadingRef.current = true;
    const offset = offsetRef.current;
    const reset = needsResetRef.current;
    needsResetRef.current = false;
    getAlbums({ sort, limit: PAGE_SIZE, offset })
      .then((data) => {
        setTotal(data.total);
        setAlbums(reset ? data.items : (prev) => [...prev, ...data.items]);
        offsetRef.current = offset + data.items.length;
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
        setFirstLoad(false);
      });
  }, [sort, albums.length, total]);

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    needsResetRef.current = true;
    offsetRef.current = 0;
    loadMoreRef.current();
  }, [sort]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          offsetRef.current = lengthRef.current;
          if (lengthRef.current < totalRef.current) {
            setLoading(true);
            loadMoreRef.current();
          }
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sort]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "title", label: t("albums.sortTitle") },
    { value: "year", label: t("albums.sortYear") },
    { value: "recent", label: t("albums.sortRecent") },
  ];

  return (
    <div>
      <PageTitle
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
        {firstLoad && albums.length === 0 ? (
          <div className="col-span-full flex justify-center py-16">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
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
      {loading && albums.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
        </div>
      )}
    </div>
  );
}
