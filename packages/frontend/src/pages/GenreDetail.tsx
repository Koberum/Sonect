import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryError } from "@/components/ui/query-error";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { AlbumCard } from "@/features/catalog/components/media-card/album-card";
import { MediaGrid } from "@/features/catalog/components/media-grid";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Disc3, Music } from "lucide-react";
import { TrackTable } from "@/features/tracks/components/track-table";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";

export default function GenreDetail() {
  const { t } = useTranslation();
  const { genre } = useParams<{ genre: string }>();

  const {
    data: albums = [],
    isPending: albumsPending,
    isError: albumsError,
    refetch: refetchAlbums,
  } = useQuery({
    ...catalogQueries.albumsByGenre(genre ?? ""),
    enabled: !!genre,
  });
  const {
    data: tracks = [],
    isPending: tracksPending,
    isError: tracksError,
    refetch: refetchTracks,
  } = useQuery({
    ...catalogQueries.tracksByGenre(genre ?? ""),
    enabled: !!genre,
  });

  if (!genre) return null;

  const isPending = albumsPending || tracksPending;
  const isError = albumsError || tracksError;
  const retry = () => {
    void refetchAlbums();
    void refetchTracks();
  };
  if (isPending) {
    return (
      <div>
        <PageHeader title={genre} description={t("genres.description")} />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div>
        <PageHeader title={genre} description={t("genres.description")} />
        <QueryError
          message={t("common.loadError")}
          onRetry={() => void retry()}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={genre} description={t("genres.description")} />
      <Tabs defaultValue="albums" className="mt-4">
        <TabsList>
          <TabsTrigger value="albums">
            {t("genres.albums")} ({albums.length})
          </TabsTrigger>
          <TabsTrigger value="tracks">
            {t("genres.tracks")} ({tracks.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="albums" className="mt-4">
          {albums.length === 0 && (
            <EmptyState icon={Disc3} title={t("albums.noAlbums")} />
          )}
          <MediaGrid>
            {albums.map((album) => (
              <AlbumCard key={album.id} album={album} className="w-full" />
            ))}
          </MediaGrid>
        </TabsContent>
        <TabsContent value="tracks" className="mt-4">
          {tracks.length === 0 && (
            <EmptyState icon={Music} title={t("tracks.noTracks")} />
          )}
          <TrackTable
            tracks={tracks}
            getNumber={(track, index) => track.track_number ?? index + 1}
            resetKey={genre}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
