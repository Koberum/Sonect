import PlayStatus from "@/features/dashboard/components/play-status";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { useParams, Link } from "react-router-dom";
import { formatTime, getCoverPath } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayIcon, ListPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { PageHeader } from "@/components/ui/page-header";
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
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import type { TrackWithRelations } from "@repo/types/catalog";

export default function AlbumPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const { data: album, isPending: albumPending } = useQuery({
    ...catalogQueries.album(id ?? ""),
    enabled: !!id,
  });
  const { data: tracks = [], isPending: tracksPending } = useQuery({
    ...catalogQueries.tracksByAlbum(id ?? ""),
    enabled: !!id,
  });
  const isPending = albumPending || tracksPending;

  const { trackPlayed } = usePlaybackContext();
  const { play, addToQueue } = usePlayTrack();
  return (
    <>
      <PageHeader
        media={
          album ? (
            <img
              src={getCoverPath(album.cover_path)}
              alt={album.title}
              className="size-24 rounded-lg object-cover shadow-sm sm:size-32 lg:size-40"
              onError={(e) => {
                e.currentTarget.src = "/default_cover.png";
              }}
            />
          ) : (
            <Skeleton className="size-24 rounded-lg sm:size-32 lg:size-40" />
          )
        }
        title={album?.title || t("album.loading")}
        description={
          album?.artist_name && album?.artist_id ? (
            <Link
              to={`/artists/${album.artist_id}/albums`}
              className="hover:underline"
            >
              {album.artist_name}
            </Link>
          ) : (
            album?.artist_name || t("album.loading")
          )
        }
      />
      <Separator className="my-4" />
      <div className="relative">
        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <ScrollArea>
            <ScrollBar orientation="horizontal" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-12 lg:table-cell">
                    {t("album.trackNumber")}
                  </TableHead>
                  <TableHead>{t("album.title")}</TableHead>
                  <TableHead className="w-28 sm:w-40">
                    {t("album.artist")}
                  </TableHead>
                  <TableHead className="w-20">{t("album.duration")}</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track: TrackWithRelations) => (
                  <ContextMenu key={track.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        className="group h-12 cursor-pointer"
                        onClick={() => play(track)}
                      >
                        <TableCell className="hidden lg:table-cell">
                          {trackPlayed?.id === track.id ? (
                            <PlayStatus />
                          ) : (
                            <>
                              <span className="group-hover:hidden">
                                {track.track_number}
                              </span>
                              <PlayIcon
                                width={15}
                                height={15}
                                fill="currentColor"
                                className="hidden transition-opacity group-hover:block"
                              />
                            </>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {track.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground w-28 sm:w-40">
                          <span className="block truncate">
                            {track.artist_id ? (
                              <Link
                                to={`/artists/${track.artist_id}/albums`}
                                className="hover:underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {track.artist_name || album?.artist_name || "-"}
                              </Link>
                            ) : (
                              track.artist_name || album?.artist_name || "-"
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTime(track.duration ?? 0)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <LikeButton trackId={track.id} />
                            <Button
                              variant="bare"
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
          </ScrollArea>
        )}
      </div>
    </>
  );
}
