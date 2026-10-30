import { useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useTranslation } from "react-i18next";
import { useParams, Link } from "react-router-dom";
import { getCoverPath } from "@/lib/utils";
import { Table, TableBody } from "@/components/ui/table";
import { Library } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { TrackRow } from "@/features/tracks/components/track-row";
import { TrackTableHeader } from "@/features/tracks/components/track-table-header";
import { setTrackDragData } from "@/features/playlists/track-drag";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { catalogQueries } from "@/features/catalog/queries";
import type { TrackWithRelations } from "@repo/types/catalog";
import {
  deriveAlbumMetadata,
  formatAlbumDuration,
} from "@/features/catalog/album-metadata";

export default function AlbumPage() {
  const { t, i18n } = useTranslation();
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

  const [draggingTrackId, setDraggingTrackId] = useState<number | null>(null);
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
                e.currentTarget.src = "/default_cover.png";
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
                      to={`/genres/${encodeURIComponent(metadata.genre)}`}
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
          <Table>
            <TrackTableHeader />
            <TableBody>
              {tracks.map((track: TrackWithRelations, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  number={track.track_number ?? index + 1}
                  draggable
                  isDragging={draggingTrackId === track.id}
                  onDragStart={(event) => {
                    setTrackDragData(event.dataTransfer, track.id);
                    setDraggingTrackId(track.id);
                  }}
                  onDragEnd={() => setDraggingTrackId(null)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </>
  );
}
