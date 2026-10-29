import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ListPlus, Play, X } from "lucide-react";
import type { TrackWithRelations } from "@repo/types/catalog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { AddToPlaylistMenu } from "@/features/dashboard/components/add-to-playlist-menu";
import { usePlayTrack } from "@/features/player/usePlayTrack";

interface TrackContextMenuProps {
  track: TrackWithRelations;
  children: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
}

export function TrackContextMenu({
  track,
  children,
  onRemove,
  removeLabel,
}: TrackContextMenuProps) {
  const { t } = useTranslation();
  const { play, addToQueue } = usePlayTrack();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => void play(track)}>
          <Play className="mr-2 size-4" fill="currentColor" />
          {t("contextMenu.play")}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void addToQueue(track.file)}>
          <ListPlus className="mr-2 size-4" />
          {t("contextMenu.playLater")}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <AddToPlaylistMenu trackId={track.id} />
        {onRemove && removeLabel ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={onRemove}
              className="text-destructive focus:text-destructive"
            >
              <X className="mr-2 size-4" />
              {removeLabel}
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
