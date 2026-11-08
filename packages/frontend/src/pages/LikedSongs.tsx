import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { Heart, Loader2, Play, Shuffle } from "lucide-react";
import { toast } from "sonner";
import type { LikedTracksPage } from "@repo/types/catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { QueryError } from "@/components/ui/query-error";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { likedQueries } from "@/features/liked/queries";
import { playLiked } from "@/features/liked/api";
import { TrackTable } from "@/features/tracks/components/track-table";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { formatDuration } from "@/lib/format";

export default function LikedSongs() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isError,
    refetch,
  } = useInfiniteQuery(likedQueries.list(profileId));

  const sentinelRef = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  });

  const playMutation = useMutation({
    mutationFn: (shuffle: boolean) => playLiked(shuffle),
    onError: () => toast.error(t("liked.playError")),
  });

  const firstPage: LikedTracksPage | undefined = data?.pages[0];
  const total = firstPage?.total ?? 0;
  const totalDuration = firstPage?.totalDuration ?? 0;
  const tracks = data?.pages.flatMap((page) => page.items) ?? [];
  const canPlay = total > 0 && !playMutation.isPending;

  const description =
    total > 0
      ? `${t("liked.count", { count: total })} · ${formatDuration(totalDuration)}`
      : t("liked.description");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">{description}</p>
        {total > 0 ? (
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
        ) : null}
      </div>

      {isPending ? (
        <ListSkeleton rows={8} />
      ) : isError ? (
        <QueryError
          message={t("liked.loadError")}
          onRetry={() => void refetch()}
        />
      ) : total === 0 ? (
        <EmptyState
          icon={Heart}
          title={t("liked.emptyTitle")}
          description={t("liked.emptyDescription")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/library", { state: { tab: "albums" } })}
            >
              {t("liked.browse")}
            </Button>
          }
        />
      ) : (
        <>
          <TrackTable tracks={tracks} showCover />
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <Skeleton className="mt-2 h-12 w-full rounded-lg" />
          )}
        </>
      )}
    </div>
  );
}
