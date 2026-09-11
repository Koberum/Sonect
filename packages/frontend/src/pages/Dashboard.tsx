import { useTranslation } from "react-i18next";
import { usePlaybackContext } from "@/components/playback-context";
import { useEffect, useState, useRef } from "react";
import type { DashboardData } from "@repo/types/library";
import { useNavigate } from "react-router-dom";
import { AlbumArtwork } from "@/features/dashboard/components/album-artwork";
import { ScrollBar, ScrollArea } from "@/components/ui/scroll-area";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import { playSong } from "@/features/apis/mpdApis";
import { ApiClient } from "@/lib/apiClient";

const apiClient = new ApiClient({
  baseUrl: `${import.meta.env.VITE_BACKEND_URL ?? ""}`,
});

const fetchDashboard = async (): Promise<DashboardData> => {
  return apiClient.get("/dashboard");
};

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { playbackStatus } = usePlaybackContext();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadDashboard = () => {
    fetchDashboard()
      .then((d) => setData(d))
      .catch(() => {
        // Dashboard fetch failed silently — keep previous data if any
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Debounced re-fetch when track changes (2s debounce)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      loadDashboard();
    }, 2000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [playbackStatus.track?.id]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-16">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title={t("dashboard.title")}
        description={t("dashboard.loading")}
      />

      {/* Section 1 — Continue Listening */}
      {data?.continueListening && data.continueListening.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.continueListening")}
          </h2>
          <ScrollArea type="always" className="w-full">
            <div className="flex gap-4 pb-4">
              {data.continueListening.map((album) => (
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

      {/* Section 2 — Recently Played */}
      {data?.recentlyPlayed && data.recentlyPlayed.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.recentlyPlayed")}
          </h2>
          <ScrollArea type="always" className="w-full">
            <div className="flex gap-3 pb-4">
              {data.recentlyPlayed.map((track) => (
                <div
                  key={track.id}
                  className="bg-card flex w-44 shrink-0 cursor-pointer flex-col gap-2 rounded-md p-3"
                  onClick={() => track.file && playSong(track)}
                >
                  <div className="bg-muted aspect-square w-full overflow-hidden rounded-md">
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

      {/* Section 3 — Top Tracks */}
      {data?.topTracks && data.topTracks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.topTracks")}
          </h2>
          <ScrollArea type="always" className="w-full">
            <div className="flex gap-3 pb-4">
              {data.topTracks.map((track) => (
                <div
                  key={track.id}
                  className="bg-card flex w-44 flex-shrink-0 cursor-pointer flex-col gap-2 rounded-md p-3"
                  onClick={() => track.file && playSong(track)}
                >
                  <div className="bg-muted aspect-square w-full overflow-hidden rounded-md">
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

      {/* Section 4 — Suggested for You */}
      {data?.suggestedTracks && data.suggestedTracks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.suggestedForYou")}
          </h2>
          <ScrollArea type="always" className="w-full">
            <div className="flex gap-3 pb-4">
              {data.suggestedTracks.map((track) => (
                <div
                  key={track.id}
                  className="bg-card flex w-44 flex-shrink-0 cursor-pointer flex-col gap-2 rounded-md p-3"
                  onClick={() => track.file && playSong(track)}
                >
                  <div className="bg-muted aspect-square w-full overflow-hidden rounded-md">
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

      {/* Section 5 — Genre Quick Mix */}
      {data?.genreQuickMix && data.genreQuickMix.tracks.length > 0 && (
        <div className="mb-8">
          <h2 className="text-muted-foreground mb-2 text-sm font-medium tracking-wider uppercase">
            {t("dashboard.genreQuickMix", {
              genre: data.genreQuickMix.genre,
            })}
          </h2>
          <div
            className="flex cursor-pointer items-center justify-between rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 p-6"
            onClick={() =>
              data.genreQuickMix!.tracks[0]?.file &&
              playSong(data.genreQuickMix!.tracks[0])
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
            <button
              className="bg-primary text-primary-foreground rounded-full px-6 py-2 text-sm font-medium"
              onClick={(e) => {
                e.stopPropagation();
                if (data.genreQuickMix!.tracks[0]?.file)
                  playSong(data.genreQuickMix!.tracks[0]);
              }}
            >
              {t("dashboard.playMix")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
