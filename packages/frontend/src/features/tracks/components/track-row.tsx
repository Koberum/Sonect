import type { DragEvent } from "react";
import type { TrackWithRelations } from "@repo/types/catalog";
import { TableCell, TableRow } from "@/components/ui/table";
import PlayStatus from "@/features/dashboard/components/play-status";
import { TrackActionsMenu } from "@/features/tracks/components/track-actions-menu";
import { usePlaybackContext } from "@/components/playback-context";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { cn, formatTime, getCoverPath } from "@/lib/utils";

interface TrackRowProps {
  track: TrackWithRelations;
  number?: number;
  showCover?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (event: DragEvent<HTMLTableRowElement>) => void;
  onDragEnd?: () => void;
  onPlay?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}

export function TrackRow({
  track,
  number,
  showCover = false,
  draggable,
  isDragging,
  onDragStart,
  onDragEnd,
  onPlay,
  onRemove,
  removeLabel,
}: TrackRowProps) {
  const { trackPlayed } = usePlaybackContext();
  const { play } = usePlayTrack();
  const isPlaying = trackPlayed?.id === track.id;

  const handlePlay = () => {
    if (onPlay) onPlay();
    else void play(track);
  };

  return (
    <TableRow
      draggable={draggable}
      aria-current={isPlaying ? "true" : undefined}
      className={cn(
        "group h-12 cursor-pointer",
        isPlaying && "bg-primary/10 hover:bg-primary/15",
        isDragging && "opacity-50",
      )}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <TableCell
        onClick={handlePlay}
        className="text-muted-foreground w-10 text-center tabular-nums"
      >
        {isPlaying ? <PlayStatus className="justify-center" /> : (number ?? "")}
      </TableCell>
      <TableCell onClick={handlePlay} className="w-full max-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {showCover && (
            <img
              src={getCoverPath(track.cover_path)}
              alt=""
              className="h-8 w-8 shrink-0 rounded-sm object-cover"
              onError={(event) => {
                event.currentTarget.src = "/default_cover.png";
              }}
            />
          )}
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate font-medium",
                isPlaying && "text-primary font-semibold",
              )}
            >
              {track.title}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {track.artist_name || "-"}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell
        onClick={handlePlay}
        className="text-muted-foreground w-14 text-right sm:w-20"
      >
        {formatTime(track.duration ?? 0)}
      </TableCell>
      <TableCell
        className="w-10 cursor-default p-1"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex justify-end">
          <TrackActionsMenu
            track={track}
            onPlay={onPlay}
            onRemove={onRemove}
            removeLabel={removeLabel}
          />
        </div>
      </TableCell>
    </TableRow>
  );
}
