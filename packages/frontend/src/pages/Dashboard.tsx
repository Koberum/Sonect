import { useTranslation } from "react-i18next";
import { useAuth } from "@/features/auth/auth-context";
import { usePlaybackContext } from "@/components/playback-context";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlbumArtwork } from "@/features/dashboard/components/album-artwork";
import { ArtistArtwork } from "@/features/dashboard/components/artist-artwork";
import { ScrollBar, ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { LikeButton } from "@/features/liked/components/like-button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { systemQueries } from "@/features/system/queries";
import { qk } from "@/lib/queryKeys";

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { playbackStatus } = usePlaybackContext();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const { play } = usePlayTrack();
  const qc = useQueryClient();

  const { data, isPending } = useQuery(systemQueries.dashboard(profileId));

  useEffect(() => {
    if (!playbackStatus.track?.id || !profileId) return;
    void qc.invalidateQueries({
      queryKey: qk.dashboard(profileId),
      refetchType: "none",
    });
  }, [playbackStatus.track?.id, profileId, qc]);

  if (isPending && !data) {
    return (
      <div>
        <PageHeader title={t("dashboard.title")} />
        <div className="space-y-8">
          {Array.from({ length: 3 }).map((_, section) => (
            <div key={section} className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="aspect-square w-36 shrink-0 rounded-lg sm:w-40"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("dashboard.title")} />

      {data?.recentlyPlayedAlbums && data.recentlyPlayedAlbums.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.recentlyPlayedAlbums")}
          </h2>
          <ScrollArea type="always" className="w-full">
            <div className="flex gap-4 pb-4">
              {data.recentlyPlayedAlbums.map((album) => (
                <AlbumArtwork
                  key={album.id}
                  album={album}
                  aspectRatio="square"
                  className="w-36 shrink-0 sm:w-40"
                  width={150}
                  height={150}
                  onClick={() => navigate(`/albums/${album.id}`)}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>
      )}

      {data?.recentlyPlayedArtists && data.recentlyPlayedArtists.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.recentlyPlayedArtists")}
          </h2>
          <ScrollArea type="always" className="w-full">
            <div className="flex gap-4 pb-4">
              {data.recentlyPlayedArtists.map((artist) => (
                <ArtistArtwork
                  key={artist.id}
                  artist={artist}
                  aspectRatio="square"
                  className="w-36 shrink-0 sm:w-40"
                  width={150}
                  height={150}
                  onClick={() => navigate(`/artists/${artist.id}/albums`)}
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>
      )}

      {data?.recentlyPlayed && data.recentlyPlayed.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.recentlyPlayed")}
          </h2>
          <ScrollArea type="always" className="w-full">
            <div className="flex gap-4 pb-4">
              {data.recentlyPlayed.map((track) => (
                <div
                  key={track.id}
                  className="bg-card flex w-44 shrink-0 cursor-pointer flex-col gap-2 rounded-lg p-3"
                  onClick={() => track.file && play(track)}
                >
                  <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-md">
                    {track.cover_path && (
                      <img
                        src={`/covers/${track.cover_path}`}
                        alt={track.title || track.file}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <LikeButton
                      trackId={track.id}
                      className="bg-background/80 absolute top-1 right-1"
                    />
                  </div>
                  <div className="space-y-1 truncate">
                    <p className="truncate text-sm leading-none font-medium">
                      {track.title}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {track.artist_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>
      )}

      {data?.topTracks && data.topTracks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.topTracks")}
          </h2>
          <ScrollArea type="always" className="w-full">
            <div className="flex gap-4 pb-4">
              {data.topTracks.map((track) => (
                <div
                  key={track.id}
                  className="bg-card flex w-44 flex-shrink-0 cursor-pointer flex-col gap-2 rounded-lg p-3"
                  onClick={() => track.file && play(track)}
                >
                  <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-md">
                    {track.cover_path && (
                      <img
                        src={`/covers/${track.cover_path}`}
                        alt={track.title || track.file}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <LikeButton
                      trackId={track.id}
                      className="bg-background/80 absolute top-1 right-1"
                    />
                  </div>
                  <div className="space-y-1 truncate">
                    <p className="truncate text-sm leading-none font-medium">
                      {track.title}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {track.artist_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>
      )}

      {data?.suggestedTracks && data.suggestedTracks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.suggestedForYou")}
          </h2>
          <ScrollArea type="always" className="w-full">
            <div className="flex gap-4 pb-4">
              {data.suggestedTracks.map((track) => (
                <div
                  key={track.id}
                  className="bg-card flex w-44 flex-shrink-0 cursor-pointer flex-col gap-2 rounded-lg p-3"
                  onClick={() => track.file && play(track)}
                >
                  <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-md">
                    {track.cover_path && (
                      <img
                        src={`/covers/${track.cover_path}`}
                        alt={track.title || track.file}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <LikeButton
                      trackId={track.id}
                      className="bg-background/80 absolute top-1 right-1"
                    />
                  </div>
                  <div className="space-y-1 truncate">
                    <p className="truncate text-sm leading-none font-medium">
                      {track.title}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {track.artist_name}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" className="hidden" />
          </ScrollArea>
        </div>
      )}

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
