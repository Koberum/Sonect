import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { QueuedTrack } from "@repo/types";
import { Button } from "@/components/ui/button";
import { LikeButton } from "@/features/liked/components/like-button";
import PlayStatus from "@/features/player/components/play-status";
import { cn, getCoverPath } from "@/lib/utils";
import { formatTime } from "@/lib/format";

interface QueueTrackRowProps {
  track: QueuedTrack;
  isCurrent: boolean;
  disabled?: boolean;
  onPlay(): void;
  onRemove(): void;
}

export function QueueTrackRow({
  track,
  isCurrent,
  disabled = false,
  onPlay,
  onRemove,
}: QueueTrackRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.pos, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      aria-current={isCurrent ? "true" : undefined}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors",
        isCurrent ? "bg-primary/10" : "hover:bg-accent/50",
        isDragging && "bg-card relative z-10 shadow-lg",
      )}
    >
      <Button
        type="button"
        variant="bare"
        size="icon-sm"
        className="cursor-grab touch-none active:cursor-grabbing"
        aria-label={t("queue.reorder")}
        disabled={disabled}
        {...attributes}
        {...listeners}
        onClick={(event) => event.stopPropagation()}
      >
        <GripVertical className="size-4" />
      </Button>

      <div className="text-muted-foreground flex w-6 shrink-0 items-center justify-center text-xs tabular-nums">
        {isCurrent ? <PlayStatus className="justify-center" /> : track.pos + 1}
      </div>

      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        aria-label={`${t("contextMenu.play")}: ${track.title}`}
        onClick={onPlay}
      >
        <img
          src={getCoverPath(track.cover_path)}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.src = "/default_cover.webp";
          }}
          className="h-10 w-10 shrink-0 rounded-md object-cover"
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-sm font-medium",
              isCurrent && "text-primary font-semibold",
            )}
          >
            {track.title}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {track.artist_name || "-"}
          </span>
        </span>
      </button>

      <span className="text-muted-foreground hidden shrink-0 text-xs tabular-nums sm:block">
        {formatTime(track.duration)}
      </span>

      <div
        role="presentation"
        className="flex shrink-0 items-center gap-1"
        onClick={(event) => event.stopPropagation()}
      >
        <LikeButton trackId={track.trackId} />
        <Button
          type="button"
          variant="bare"
          size="icon-sm"
          className="text-muted-foreground hover:text-foreground"
          aria-label={t("queue.remove")}
          onClick={onRemove}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
