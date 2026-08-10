import { getLibraryStats } from "@/features/apis/libraryApis";
import { usePlaybackContext } from "@/components/playback-context";
import { PageTitle } from "@/features/dashboard/components/pageTitle";
import type { LibraryStats } from "@repo/types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlbumIcon,
  BarChart3,
  Calendar,
  Clock,
  DiscAlbum,
  ListMusic,
  MicVocal,
  Music,
  RefreshCw,
  Tags,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDuration(seconds: number): string {
  if (seconds === 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatAvgDuration(seconds: number): string {
  if (seconds === 0) return "0s";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatDate(
  isoString: string | null,
  t: (key: string) => string,
): string {
  if (!isoString) return t("statistics.never");
  return new Date(isoString).toLocaleString();
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-muted-foreground text-xs">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function Statistics() {
  const { t } = useTranslation();
  usePlaybackContext();
  const [stats, setStats] = useState<LibraryStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      const data = await getLibraryStats();
      setStats(data);
    };
    fetchStats();
  }, []);

  if (!stats) {
    return (
      <div>
        <PageTitle
          title={t("statistics.title")}
          description={t("statistics.description")}
        />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageTitle
        title={t("statistics.title", "Library Statistics")}
        description={t(
          "statistics.description",
          "Overview of your music library",
        )}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title={t("statistics.totalTracks")}
          value={stats.totalTracks}
          icon={<Music className="h-4 w-4" />}
        />
        <StatCard
          title={t("statistics.totalArtists")}
          value={stats.totalArtists}
          icon={<MicVocal className="h-4 w-4" />}
        />
        <StatCard
          title={t("statistics.totalAlbums")}
          value={stats.totalAlbums}
          icon={<AlbumIcon className="h-4 w-4" />}
        />
        <StatCard
          title={t("statistics.totalPlaylists")}
          value={stats.totalPlaylists}
          icon={<ListMusic className="h-4 w-4" />}
        />
        <StatCard
          title={t("statistics.totalGenres")}
          value={stats.totalGenres}
          icon={<Tags className="h-4 w-4" />}
        />
        <StatCard
          title={t("statistics.totalDuration")}
          value={formatDuration(stats.totalDuration)}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          title={t("statistics.averageDuration")}
          value={formatAvgDuration(stats.averageDuration)}
          icon={<BarChart3 className="h-4 w-4" />}
        />
        <StatCard
          title={t("statistics.earliestYear")}
          value={stats.earliestYear ?? "—"}
          icon={<Calendar className="h-4 w-4" />}
        />
        <StatCard
          title={t("statistics.latestYear")}
          value={stats.latestYear ?? "—"}
          icon={<Calendar className="h-4 w-4" />}
        />
        <StatCard
          title={t("statistics.tracksWithoutAlbum")}
          value={stats.tracksWithoutAlbum}
          icon={<DiscAlbum className="h-4 w-4" />}
          description={
            stats.totalTracks > 0
              ? t("statistics.percentOfLibrary", {
                  percent: (
                    (stats.tracksWithoutAlbum / stats.totalTracks) *
                    100
                  ).toFixed(1),
                })
              : undefined
          }
        />
        <StatCard
          title={t("statistics.lastSync")}
          value={formatDate(stats.lastSync, t)}
          icon={<RefreshCw className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}
