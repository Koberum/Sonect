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
  type QualityOption,
  type QualitySort,
} from "../quality";

export type TrackTableQualityMode =
  | { kind: "client" }
  | { kind: "none" }
  | {
      kind: "server";
      filter: string | null;
      sort: QualitySort;
      options: QualityOption[];
      onFilterChange: (key: string | null) => void;
      onSortChange: (sort: QualitySort) => void;
    };

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
  qualityMode = { kind: "client" },
  resetKey,
}: TrackTableProps<T>) {
  const { t } = useTranslation();
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [clientSort, setClientSort] = useState<QualitySort>("none");

  useEffect(() => {
    setClientFilter(null);
    setClientSort("none");
  }, [resetKey]);

  const derivedOptions = useMemo(
    () => qualityOptionsFromTracks(tracks),
    [tracks],
  );
  const qualityOptions =
    qualityMode.kind === "server" ? qualityMode.options : derivedOptions;
  const showQuality =
    qualityMode.kind === "server"
      ? qualityMode.options.length > 0 || tracks.some(hasQualityData)
      : tracks.some(hasQualityData);
  const qualityFilter =
    qualityMode.kind === "server"
      ? qualityMode.filter
      : qualityMode.kind === "client"
        ? clientFilter
        : null;
  const qualitySort =
    qualityMode.kind === "server"
      ? qualityMode.sort
      : qualityMode.kind === "client"
        ? clientSort
        : "none";
  const setQualityFilter =
    qualityMode.kind === "server"
      ? qualityMode.onFilterChange
      : setClientFilter;
  const setQualitySort =
    qualityMode.kind === "server" ? qualityMode.onSortChange : setClientSort;
  // A single quality value makes sort/filter a no-op; keep the column but
  // suppress the controls until there is something to choose between.
  const qualityControlsEnabled =
    qualityMode.kind !== "none" && qualityOptions.length > 1;

  useEffect(() => {
    if (qualityMode.kind !== "client") return;
    if (
      clientFilter !== null &&
      !derivedOptions.some((option) => option.key === clientFilter)
    ) {
      setClientFilter(null);
    }
  }, [qualityMode.kind, clientFilter, derivedOptions]);

  if (isPending) {
    return <ListSkeleton rows={skeletonRows} />;
  }

  const visibleTracks =
    qualityMode.kind === "client"
      ? filterAndSortTracks(tracks, clientFilter, clientSort)
      : tracks;

  if (
    qualityMode.kind === "client" &&
    clientFilter !== null &&
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
            onClick={() => setClientFilter(null)}
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
