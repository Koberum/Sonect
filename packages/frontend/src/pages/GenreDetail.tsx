import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { AlbumArtwork } from "@/features/dashboard/components/album-artwork";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody } from "@/components/ui/table";
import { Disc3, Music } from "lucide-react";
import { TrackRow } from "@/features/tracks/components/track-row";
import { TrackTableHeader } from "@/features/tracks/components/track-table-header";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";

export default function GenreDetail() {
  const { t } = useTranslation();
  const { genre } = useParams<{ genre: string }>();
  const navigate = useNavigate();

  const { data: albums = [], isPending: albumsPending } = useQuery({
    ...catalogQueries.albumsByGenre(genre ?? ""),
    enabled: !!genre,
  });
  const { data: tracks = [], isPending: tracksPending } = useQuery({
    ...catalogQueries.tracksByGenre(genre ?? ""),
    enabled: !!genre,
  });

  if (!genre) return null;

  const isPending = albumsPending || tracksPending;
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
            {albums.map((album) => (
              <AlbumArtwork
                key={album.id}
                album={album}
                className="w-full"
                onClick={() => navigate(`/albums/${album.id}`)}
              />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="tracks" className="mt-4">
          {tracks.length === 0 && (
            <EmptyState icon={Music} title={t("tracks.noTracks")} />
          )}
          <Table>
            <TrackTableHeader />
            <TableBody>
              {tracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  number={track.track_number ?? index + 1}
                />
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
