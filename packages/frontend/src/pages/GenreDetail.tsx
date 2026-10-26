import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { AlbumArtwork } from "@/features/dashboard/components/album-artwork";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTime } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayIcon, ListPlus, Disc3, Music } from "lucide-react";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { usePlaybackContext } from "@/components/playback-context";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AddToPlaylistMenu } from "@/features/dashboard/components/add-to-playlist-menu";
import { LikeButton } from "@/features/liked/components/like-button";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";

export default function GenreDetail() {
  const { t } = useTranslation();
  const { genre } = useParams<{ genre: string }>();
  const navigate = useNavigate();
  const { trackPlayed } = usePlaybackContext();
  const { play, addToQueue } = usePlayTrack();

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
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>{t("album.title")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("tracks.artist")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("tracks.album")}
                </TableHead>
                <TableHead className="w-20">{t("album.duration")}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track) => (
                <ContextMenu key={track.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow
                      className="group h-12 cursor-pointer"
                      onClick={() => play(track)}
                    >
                      <TableCell>
                        {trackPlayed?.id === track.id ? (
                          <div className="flex items-end gap-1">
                            <div
                              className="bg-primary eq h-1 w-1 rounded"
                              style={{ animationDelay: "0ms" }}
                            />
                            <div
                              className="bg-primary eq h-2 w-1 rounded"
                              style={{ animationDelay: "150ms" }}
                            />
                            <div
                              className="bg-primary eq h-3 w-1 rounded"
                              style={{ animationDelay: "300ms" }}
                            />
                          </div>
                        ) : (
                          <PlayIcon
                            width={15}
                            height={15}
                            fill="currentColor"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {track.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        {track.artist_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">
                        {track.album_id ? (
                          <span
                            className="cursor-pointer hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/albums/${track.album_id}`);
                            }}
                          >
                            {track.album_title || "-"}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatTime(track.duration ?? 0)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <LikeButton trackId={track.id} />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToQueue(track.file);
                            }}
                            aria-label={t("album.addToQueue")}
                          >
                            <ListPlus />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem onClick={() => play(track)}>
                      {t("contextMenu.play")}
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        addToQueue(track.file);
                      }}
                    >
                      {t("contextMenu.playLater")}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <AddToPlaylistMenu trackId={track.id} />
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
