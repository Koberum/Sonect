import { getAlbumsByArtist, getArtistById } from "@/features/apis/libraryApis";
import { AlbumArtwork } from "@/features/dashboard/components/album-artwork";
import { usePlaybackContext } from "@/components/playback-context";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import { SortTabs } from "@/features/dashboard/components/sort-tabs";
import type { Album, Artist } from "@repo/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";

type SortOption = "title" | "year" | "recent";

export function ArtistAlbums() {
  const { t } = useTranslation();
  const { artistId } = useParams();
  const navigate = useNavigate();
  usePlaybackContext();
  const [albums, setAlbums] = useState<Album[]>();
  const [artist, setArtist] = useState<Artist>();
  const [sort, setSort] = useState<SortOption>("year");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlbums = async () => {
      if (!artistId) return;
      setLoading(true);
      try {
        const fetchedAlbums = await getAlbumsByArtist(artistId);
        const fetchedArtist = await getArtistById(artistId);
        setAlbums(fetchedAlbums);
        setArtist(fetchedArtist);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbums();
  }, [artistId]);

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
      <PageTitle
        title={artist ? artist.name : t("artist.loading")}
        description={t("artist.description")}
      />
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
        </div>
      ) : (
        <>
          <SortTabs
            value={sort}
            onValueChange={setSort}
            options={sortOptions}
          />
          <div className="mt-4 flex flex-wrap gap-4">
            {sortedAlbums.map((album) => (
              <div
                key={album.id}
                className="min-w-40 flex-1 sm:max-w-20 md:max-w-40"
              >
                <AlbumArtwork
                  album={album}
                  aspectRatio="square"
                  className="w-full"
                  onClick={() => navigate(`/albums/${album.id}`)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
