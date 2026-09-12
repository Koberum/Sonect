import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useRef, useEffect, useState } from "react";
import { formatTime } from "@/lib/utils";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PlayIcon, ListPlus } from "lucide-react";
import { playSong, addToQueue } from "@/features/mpd/api";
import { usePlaybackContext } from "@/components/playback-context";
import { SortTabs } from "@/features/dashboard/components/sort-tabs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AddToPlaylistMenu } from "@/features/dashboard/components/add-to-playlist-menu";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";

type SortOption = "title" | "recent" | "duration";

export default function Tracks() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [sort, setSort] = useState<SortOption>("title");
  const { trackPlayed } = usePlaybackContext();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery(catalogQueries.tracksInfinite(sort));

  const tracks = data?.pages.flatMap((p) => p.items) ?? [];

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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, sort]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: "title", label: t("album.title") },
    { value: "recent", label: t("albums.sortRecent") },
    { value: "duration", label: t("album.duration") },
  ];

  return (
    <div>
      <PageTitle
        title={t("tracks.title")}
        description={t("tracks.description")}
      />
      <SortTabs
        value={sort}
        onValueChange={setSort}
        options={sortOptions}
        className="mb-4"
      />
      <ScrollArea>
        <ScrollBar orientation="horizontal" />
        {isPending ? (
          <div className="flex justify-center py-16">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        ) : (
          <>
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
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.length === 0 && !isFetchingNextPage && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      {t("tracks.noTracks")}
                    </TableCell>
                  </TableRow>
                )}
                {tracks.map((track) => (
                  <ContextMenu key={track.id}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        className="group h-12 cursor-pointer"
                        onClick={() => playSong(track)}
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
            <div ref={sentinelRef} className="h-4" />
          </>
        )}
      </ScrollArea>
      {isFetchingNextPage && (
        <div className="flex justify-center py-4">
          <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2" />
        </div>
      )}
    </div>
  );
}
