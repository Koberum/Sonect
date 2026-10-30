import { Fragment, useState, type SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import {
  EllipsisVertical,
  Heart,
  ListMusic,
  ListPlus,
  Play,
  X,
} from "lucide-react";
import type { TrackWithRelations } from "@repo/types/catalog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useToggleLike } from "@/features/liked/useToggleLike";
import { usePlayTrack } from "@/features/player/usePlayTrack";
import { AddToPlaylistDialog } from "@/features/playlists/components/add-to-playlist-dialog";

interface TrackActionsMenuProps {
  track: TrackWithRelations;
  onRemove?: () => void;
  removeLabel?: string;
  onPlay?: () => void;
}

interface TrackAction {
  key: string;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  filledIcon?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export function TrackActionsMenu({
  track,
  onRemove,
  removeLabel,
  onPlay,
}: TrackActionsMenuProps) {
  const { t } = useTranslation();
  const { play, addToQueue } = usePlayTrack();
  const { liked, isPending: likePending, toggle } = useToggleLike(track.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  const handlePlay = () => {
    if (onPlay) onPlay();
    else void play(track);
  };

  const actions: TrackAction[] = [
    {
      key: "play",
      icon: Play,
      label: t("contextMenu.play"),
      onSelect: handlePlay,
      filledIcon: true,
    },
    {
      key: "queue",
      icon: ListPlus,
      label: t("contextMenu.addToQueue"),
      onSelect: () => void addToQueue(track.file),
    },
    {
      key: "like",
      icon: Heart,
      label: liked ? t("liked.unlike") : t("liked.like"),
      onSelect: toggle,
      filledIcon: liked,
      disabled: likePending,
      separatorBefore: true,
    },
    {
      key: "playlist",
      icon: ListMusic,
      label: t("contextMenu.addToPlaylist"),
      onSelect: () => setPlaylistOpen(true),
    },
  ];

  if (onRemove && removeLabel) {
    actions.push({
      key: "remove",
      icon: X,
      label: removeLabel,
      onSelect: onRemove,
      destructive: true,
      separatorBefore: true,
    });
  }

  const handleSheetAction = (event: SyntheticEvent, action: TrackAction) => {
    event.stopPropagation();
    setSheetOpen(false);
    requestAnimationFrame(() => action.onSelect());
  };

  const stopRowActivation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <span
      data-track-actions
      className="contents"
      onClick={stopRowActivation}
      onPointerDown={stopRowActivation}
      onMouseDown={stopRowActivation}
      onTouchStart={stopRowActivation}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="bare"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground hidden md:inline-flex"
            aria-label={t("trackActions.open")}
            onClick={stopRowActivation}
            onPointerDown={stopRowActivation}
            onMouseDown={stopRowActivation}
            onTouchStart={stopRowActivation}
          >
            <EllipsisVertical />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map((action) => (
            <Fragment key={action.key}>
              {action.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                disabled={action.disabled}
                className={cn(
                  action.destructive &&
                    "text-destructive focus:text-destructive",
                )}
                onSelect={() => action.onSelect()}
              >
                <action.icon
                  className={cn(action.filledIcon && "fill-current")}
                />
                {action.label}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="bare"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground md:hidden"
            aria-label={t("trackActions.open")}
            onClick={stopRowActivation}
            onPointerDown={stopRowActivation}
            onMouseDown={stopRowActivation}
            onTouchStart={stopRowActivation}
          >
            <EllipsisVertical />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 max-w-[85vw]">
          <SheetHeader className="pr-6">
            <SheetTitle className="truncate">{track.title}</SheetTitle>
            <SheetDescription className="truncate">
              {track.artist_name || "-"}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-col">
            {actions.map((action) => (
              <Fragment key={action.key}>
                {action.separatorBefore && <Separator className="my-1" />}
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-11 w-full justify-start gap-2",
                    action.destructive &&
                      "text-destructive hover:text-destructive",
                  )}
                  disabled={action.disabled}
                  onClick={(event) => handleSheetAction(event, action)}
                >
                  <action.icon
                    className={cn(action.filledIcon && "fill-current")}
                  />
                  {action.label}
                </Button>
              </Fragment>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AddToPlaylistDialog
        trackId={track.id}
        open={playlistOpen}
        onOpenChange={setPlaylistOpen}
      />
    </span>
  );
}
