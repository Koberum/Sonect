import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Heart, Loader2, Play, Shuffle } from "lucide-react";
import { toast } from "sonner";
import type { LikedTracksPage } from "@repo/types/catalog";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAuth } from "@/features/auth/auth-context";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { LikeButton } from "@/features/liked/components/like-button";
import { likedQueries } from "@/features/liked/queries";
import { playLiked } from "@/features/liked/api";
import { TrackContextMenu } from "@/features/tracks/components/track-context-menu";
import { formatTime, getCoverPath } from "@/lib/utils";

function formatTotalDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${total}s`;
}

export default function LikedSongs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const { play } = usePlayTrack();
  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    refetch,
  } = useInfiniteQuery(likedQueries.list(profileId));

  const playMutation = useMutation({
    mutationFn: (shuffle: boolean) => playLiked(shuffle),
    onError: () => toast.error(t("liked.playError")),
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const firstPage: LikedTracksPage | undefined = data?.pages[0];
  const total = firstPage?.total ?? 0;
  const totalDuration = firstPage?.totalDuration ?? 0;
  const tracks = data?.pages.flatMap((page) => page.items) ?? [];
  const canPlay = total > 0 && !playMutation.isPending;

  const description =
    total > 0
      ? `${t("liked.count", { count: total })} · ${formatTotalDuration(totalDuration)}`
      : t("liked.description");

  return (
    <div>
      <PageHeader
        title={t("liked.title")}
        description={description}
        actions={
          total > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!canPlay}
                onClick={() => playMutation.mutate(true)}
              >
                {playMutation.isPending && playMutation.variables === true ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Shuffle />
                )}
                {t("liked.shuffle")}
              </Button>
              <Button
                size="sm"
                disabled={!canPlay}
                onClick={() => playMutation.mutate(false)}
              >
                {playMutation.isPending && playMutation.variables === false ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Play />
                )}
                {t("liked.playAll")}
              </Button>
            </div>
          ) : undefined
        }
      />

      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="border-destructive/40 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
          <p className="text-destructive text-sm">{t("liked.loadError")}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      ) : total === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("liked.emptyTitle")}
          description={t("liked.emptyDescription")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/albums")}
            >
              {t("liked.browse")}
            </Button>
          }
        />
      ) : (
        <ScrollArea>
          <ScrollBar orientation="horizontal" />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead>{t("album.title")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("tracks.artist")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("tracks.album")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("tracks.genre")}
                </TableHead>
                <TableHead className="w-20">{t("album.duration")}</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tracks.map((track, index) => (
                <TrackContextMenu key={track.id} track={track}>
                  <TableRow
                    className="group h-12 cursor-pointer"
                    onClick={() => play(track)}
                  >
                    <TableCell className="text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <img
                        src={getCoverPath(track.cover_path)}
                        alt=""
                        className="h-8 w-8 rounded-sm object-cover"
                        onError={(event) => {
                          event.currentTarget.src = "/default_cover.png";
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <p className="truncate">{track.title}</p>
                      <p className="text-muted-foreground truncate text-xs sm:hidden">
                        {track.artist_name}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden sm:table-cell">
                      {track.artist_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell">
                      {track.album_title || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden max-w-40 truncate lg:table-cell">
                      {track.genre || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatTime(track.duration ?? 0)}
                    </TableCell>
                    <TableCell>
                      <LikeButton trackId={track.id} />
                    </TableCell>
                  </TableRow>
                </TrackContextMenu>
              ))}
            </TableBody>
          </Table>
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <Skeleton className="mt-2 h-12 w-full rounded-lg" />
          )}
        </ScrollArea>
      )}
    </div>
  );
}
