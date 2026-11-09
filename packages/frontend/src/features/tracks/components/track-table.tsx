import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Filter } from "lucide-react";
import type { TrackWithRelations } from "@repo/types/catalog";
import { Table, TableBody } from "@/components/ui/table";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { TrackRow } from "./track-row";
import { TrackTableHeader } from "./track-table-header";
import {
  filterAndSortTracks,
  hasQualityData,
  qualityOptionsFromTracks,
  type QualitySort,
} from "../quality";

export type TrackTableQualityMode = "client" | "none";

export interface TrackTableProps<T extends TrackWithRelations> {
  tracks: T[];
  isPending?: boolean;
  skeletonRows?: number;
  getKey?: (track: T) => string | number;
  getNumber?: (track: T, index: number) => number | undefined;
  showCover?: boolean;
  onPlay?: (track: T) => void;
  onRemove?: (track: T) => void;
  removeLabel?: string;
  qualityMode?: TrackTableQualityMode;
  resetKey?: string | number;
}

/**
 * Track listing shared by albums, genres, liked songs and playlists: header,
 * body, loading skeleton and per-track action wiring in one place.
 */
export function TrackTable<T extends TrackWithRelations>({
  tracks,
  isPending = false,
  skeletonRows = 6,
  getKey = (track) => track.id,
  getNumber = (_track, index) => index + 1,
  showCover,
  onPlay,
  onRemove,
  removeLabel,
  qualityMode = "client",
  resetKey,
}: TrackTableProps<T>) {
  const { t } = useTranslation();
  const [qualityFilter, setQualityFilter] = useState<string | null>(null);
  const [qualitySort, setQualitySort] = useState<QualitySort>("none");

  useEffect(() => {
    setQualityFilter(null);
    setQualitySort("none");
  }, [resetKey]);

  const qualityOptions = useMemo(
    () => qualityOptionsFromTracks(tracks),
    [tracks],
  );
  const showQuality = tracks.some(hasQualityData);
  const qualityControlsEnabled =
    qualityMode !== "none" && qualityOptions.length > 1;

  useEffect(() => {
    if (
      qualityFilter !== null &&
      !qualityOptions.some((option) => option.key === qualityFilter)
    ) {
      setQualityFilter(null);
    }
  }, [qualityFilter, qualityOptions]);

  if (isPending) {
    return <ListSkeleton rows={skeletonRows} />;
  }

  const visibleTracks =
    qualityMode === "none"
      ? tracks
      : filterAndSortTracks(tracks, qualityFilter, qualitySort);

  if (
    qualityMode !== "none" &&
    qualityFilter !== null &&
    visibleTracks.length === 0 &&
    tracks.length > 0
  ) {
    return (
      <EmptyState
        icon={Filter}
        title={t("trackTable.noQualityMatches")}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setQualityFilter(null)}
          >
            {t("trackTable.clearFilter")}
          </Button>
        }
      />
    );
  }

  return (
    <Table>
      <TrackTableHeader
        showQuality={showQuality}
        qualityOptions={qualityOptions}
        qualityFilter={qualityFilter}
        qualitySort={qualitySort}
        qualityControlsEnabled={qualityControlsEnabled}
        onQualityFilterChange={setQualityFilter}
        onQualitySortChange={setQualitySort}
      />
      <TableBody>
        {visibleTracks.map((track, index) => (
          <TrackRow
            key={getKey(track)}
            track={track}
            number={getNumber(track, index)}
            showCover={showCover}
            showQuality={showQuality}
            onPlay={onPlay ? () => onPlay(track) : undefined}
            onRemove={onRemove ? () => onRemove(track) : undefined}
            removeLabel={removeLabel}
          />
        ))}
      </TableBody>
    </Table>
  );
}
