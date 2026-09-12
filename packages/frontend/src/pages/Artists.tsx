import { getArtists } from "@/features/apis/catalogApis";
import { ArtistArtwork } from "@/features/dashboard/components/artist-artwork";
import { usePlaybackContext } from "@/components/playback-context";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import type { Artist } from "@repo/types/catalog";
import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 50;

export function Artists() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  usePlaybackContext();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [total, setTotal] = useState(0);
  const [firstLoad, setFirstLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);
  const needsResetRef = useRef(true);
  const lengthRef = useRef(artists.length);
  const totalRef = useRef(total);

  useEffect(() => {
    lengthRef.current = artists.length;
    totalRef.current = total;
  });

  const loadMore = useCallback(() => {
    if (loadingRef.current) return;
    if (!needsResetRef.current && artists.length >= total && total > 0) return;
    loadingRef.current = true;
    const offset = offsetRef.current;
    const reset = needsResetRef.current;
    needsResetRef.current = false;
    getArtists({ limit: PAGE_SIZE, offset })
      .then((data) => {
        setTotal(data.total);
        setArtists(reset ? data.items : (prev) => [...prev, ...data.items]);
        offsetRef.current = offset + data.items.length;
      })
      .finally(() => {
        loadingRef.current = false;
        setLoading(false);
        setFirstLoad(false);
      });
  }, [artists.length, total]);

  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    needsResetRef.current = true;
    offsetRef.current = 0;
    loadMoreRef.current();
  }, []);

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
  }, []);

  return (
    <div>
      <PageTitle
        title={t("artists.title")}
        description={t("artists.description")}
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
        {firstLoad && artists.length === 0 ? (
          <div className="flex w-full justify-center py-16">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        ) : (
          artists.map((artist) => (
            <ArtistArtwork
              artist={artist}
              aspectRatio="square"
              className="w-full"
              onClick={() => navigate(`/artists/${artist.id}/albums`)}
            />
          ))
        )}
      </div>
      <div ref={sentinelRef} className="h-4" />
      {loading && artists.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
        </div>
      )}
    </div>
  );
}
