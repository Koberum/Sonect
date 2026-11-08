import type { TrackWithRelations } from "@repo/types/catalog";
import { Table, TableBody } from "@/components/ui/table";
import { ListSkeleton } from "@/components/ui/list-skeleton";
import { TrackRow } from "./track-row";
import { TrackTableHeader } from "./track-table-header";

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
}: TrackTableProps<T>) {
  if (isPending) {
    return <ListSkeleton rows={skeletonRows} />;
  }

  return (
    <Table>
      <TrackTableHeader />
      <TableBody>
        {tracks.map((track, index) => (
          <TrackRow
            key={getKey(track)}
            track={track}
            number={getNumber(track, index)}
            showCover={showCover}
            onPlay={onPlay ? () => onPlay(track) : undefined}
            onRemove={onRemove ? () => onRemove(track) : undefined}
            removeLabel={removeLabel}
          />
        ))}
      </TableBody>
    </Table>
  );
}
