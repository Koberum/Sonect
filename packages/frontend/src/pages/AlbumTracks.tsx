import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getAlbumById, getTracksByAlbum } from "@/features/apis/libraryApis";
import type { Album, Track } from "@repo/types";
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
import { playSong, addToQueue } from "@/features/apis/mpdApis";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import { usePlaybackContext } from "@/components/playback-context";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AddToPlaylistMenu } from "@/features/dashboard/components/add-to-playlist-menu";

export default function AlbumPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [album, setAlbum] = useState<Album>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const album = await getAlbumById(id!);
        setAlbum(album);
        const tracks = await getTracksByAlbum(id!);
        setTracks(tracks);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const { trackPlayed } = usePlaybackContext();
  return (
    <>
      <PageTitle
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
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        ) : (
          <ScrollArea>
            <ScrollBar orientation="horizontal" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="hidden w-12.5 lg:table-cell">
                    {t("album.trackNumber")}
                  </TableHead>
                  <TableHead className="w-20"></TableHead>
                  <TableHead>{t("album.title")}</TableHead>
                  <TableHead className="w-20">{t("album.duration")}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track: Track) => (
                  <ContextMenu key={track.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        className="group h-15 cursor-pointer"
                        onClick={() => playSong(track)}
                      >
                        <TableCell className="hidden lg:table-cell">
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
                        <TableCell className="relative font-medium">
                          <img
                            className="rounded-sm"
                            src={getCoverPath(track.cover_path)}
                            alt={track.title}
                          />
                        </TableCell>

                        <TableCell>
                          {track.title}
                          <p className="text-muted-foreground text-sm">
                            {album?.artist_name}
                            {track.artist_name &&
                            track.artist_name !== album?.artist_name
                              ? `, ${track.artist_name}`
                              : ""}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatTime(track.duration ?? 0)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToQueue(track.file);
                            }}
                            title={t("album.addToQueue")}
                          >
                            <ListPlus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onClick={() => playSong(track)}>
                        {t("contextMenu.playNext")}
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
