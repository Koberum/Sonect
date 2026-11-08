import { useTranslation } from "react-i18next";
import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { usePlaybackContext } from "@/components/playback-context";
import { AlbumCard } from "@/features/catalog/components/media-card/album-card";
import { ArtistCard } from "@/features/catalog/components/media-card/artist-card";
import { TrackCard } from "@/features/catalog/components/media-card/track-card";
import { MediaCarousel } from "@/features/catalog/components/media-carousel";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { Button } from "@/components/ui/button";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { systemQueries } from "@/features/system/queries";
import { qk } from "@/lib/queryKeys";

function CarouselSection<T>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: T[] | undefined;
  renderItem: (item: T) => ReactNode;
}) {
  if (!items?.length) return null;
  return <MediaCarousel title={title}>{items.map(renderItem)}</MediaCarousel>;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { playbackStatus } = usePlaybackContext();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const { play } = usePlayTrack();
  const qc = useQueryClient();

  const { data, isPending, isError, refetch } = useQuery(
    systemQueries.dashboard(profileId),
  );

  useEffect(() => {
    if (!playbackStatus.track?.id || !profileId) return;
    void qc.invalidateQueries({
      queryKey: qk.dashboard(profileId),
      refetchType: "none",
    });
  }, [playbackStatus.track?.id, profileId, qc]);

  if (isError) {
    return (
      <QueryError
        message={t("common.loadError")}
        onRetry={() => void refetch()}
      />
    );
  }

  if (isPending && !data) {
    return (
      <div className="space-y-8">
        {Array.from({ length: 3 }).map((_, section) => (
          <div key={section} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="aspect-square w-44 shrink-0 rounded-lg"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <CarouselSection
        title={t("dashboard.recentlyPlayedAlbums")}
        items={data?.recentlyPlayedAlbums}
        renderItem={(album) => (
          <AlbumCard key={album.id} album={album} className="w-44 shrink-0" />
        )}
      />

      <CarouselSection
        title={t("dashboard.recentlyPlayedArtists")}
        items={data?.recentlyPlayedArtists}
        renderItem={(artist) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            className="w-44 shrink-0"
          />
        )}
      />

      <CarouselSection
        title={t("dashboard.recentlyPlayed")}
        items={data?.recentlyPlayed}
        renderItem={(track) => (
          <TrackCard key={track.id} track={track} className="w-44 shrink-0" />
        )}
      />

      <CarouselSection
        title={t("dashboard.topTracks")}
        items={data?.topTracks}
        renderItem={(track) => (
          <TrackCard key={track.id} track={track} className="w-44 shrink-0" />
        )}
      />

      <CarouselSection
        title={t("dashboard.suggestedForYou")}
        items={data?.suggestedTracks}
        renderItem={(track) => (
          <TrackCard key={track.id} track={track} className="w-44 shrink-0" />
        )}
      />

      {data?.genreQuickMix && data.genreQuickMix.tracks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.genreQuickMix", {
              genre: data.genreQuickMix.genre,
            })}
          </h2>
          <div
            className="from-primary/15 to-primary/5 flex cursor-pointer items-center justify-between rounded-lg bg-gradient-to-br p-6"
            onClick={() =>
              data.genreQuickMix!.tracks[0]?.file &&
              play(data.genreQuickMix!.tracks[0])
            }
          >
            <div>
              <p className="text-lg font-semibold">
                {data.genreQuickMix.genre}
              </p>
              <p className="text-muted-foreground text-sm">
                {t("dashboard.trackCount", {
                  count: data.genreQuickMix.tracks.length,
                })}
              </p>
            </div>
            <Button
              className="rounded-full px-6"
              onClick={(e) => {
                e.stopPropagation();
                if (data.genreQuickMix!.tracks[0]?.file)
                  play(data.genreQuickMix!.tracks[0]);
              }}
            >
              {t("dashboard.playMix")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
