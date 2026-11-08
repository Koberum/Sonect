import { useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { useParams, Link } from "react-router-dom";
import { getCoverPath } from "@/lib/utils";
import { Library } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/ui/query-error";
import { PageHeader } from "@/components/ui/page-header";
import { TrackTable } from "@/features/tracks/components/track-table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import {
  deriveAlbumMetadata,
  formatAlbumDuration,
} from "@/features/catalog/album-metadata";

export default function AlbumPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const {
    data: album,
    isPending: albumPending,
    isError: albumError,
    refetch: refetchAlbum,
  } = useQuery({
    ...catalogQueries.album(id ?? ""),
    enabled: !!id,
  });
  const {
    data: tracks = [],
    isPending: tracksPending,
    isError: tracksError,
    refetch: refetchTracks,
  } = useQuery({
    ...catalogQueries.tracksByAlbum(id ?? ""),
    enabled: !!id,
  });
  const isPending = albumPending || tracksPending;
  const isError = albumError || tracksError;
  const retry = () => {
    void refetchAlbum();
    void refetchTracks();
  };

  const metadata = useMemo(
    () => deriveAlbumMetadata(album, tracks),
    [album, tracks],
  );
  const durationLabel = formatAlbumDuration(
    metadata.totalDuration,
    i18n.language,
  );
  const metaParts = [
    metadata.year ? String(metadata.year) : null,
    metadata.trackCount > 0
      ? t("album.trackCount", { count: metadata.trackCount })
      : null,
    durationLabel,
  ].filter((part): part is string => Boolean(part));
  const hasBadges =
    Boolean(metadata.genre) ||
    metadata.formats.length > 0 ||
    metadata.sourceNames.length > 0;

  if (isError && !album) {
    return (
      <QueryError
        message={t("common.loadError")}
        onRetry={() => void retry()}
      />
    );
  }

  return (
    <>
      <PageHeader
        metaAlign="end"
        media={
          album ? (
            <img
              src={getCoverPath(album.cover_path)}
              alt={album.title}
              className="size-24 rounded-lg object-cover shadow-sm sm:size-32 lg:size-40"
              onError={(e) => {
                e.currentTarget.src = "/default_cover.webp";
              }}
            />
          ) : (
            <Skeleton className="size-24 rounded-lg sm:size-32 lg:size-40" />
          )
        }
        title={album?.title || t("album.loading")}
        meta={
          isPending ? (
            <Skeleton className="h-5 w-56" />
          ) : metaParts.length > 0 || hasBadges ? (
            <div className="space-y-2">
              {metaParts.length > 0 && (
                <p className="text-muted-foreground text-sm">
                  {metaParts.join(" · ")}
                </p>
              )}
              {hasBadges && (
                <div className="flex flex-wrap items-center gap-2">
                  {metadata.genre && (
                    <Link
                      to={`/library/genres/${encodeURIComponent(metadata.genre)}`}
                      className="focus-visible:ring-ring rounded-md focus-visible:ring-2 focus-visible:outline-none"
                    >
                      <Badge variant="secondary">{metadata.genre}</Badge>
                    </Link>
                  )}
                  {metadata.formats.map((format) => (
                    <Badge key={format} variant="outline">
                      {format}
                    </Badge>
                  ))}
                  {metadata.sourceNames.map((name) => (
                    <Badge key={name} variant="outline" className="gap-1">
                      <Library className="size-4" aria-hidden="true" />
                      {name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : undefined
        }
        description={
          album?.artist_name && album?.artist_id ? (
            <Link
              to={`/library/artists/${album.artist_id}`}
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
        {isError ? (
          <QueryError
            message={t("common.loadError")}
            onRetry={() => void retry()}
          />
        ) : (
          <TrackTable
            tracks={tracks}
            isPending={isPending}
            getNumber={(track, index) => track.track_number ?? index + 1}
          />
        )}
      </div>
    </>
  );
}
