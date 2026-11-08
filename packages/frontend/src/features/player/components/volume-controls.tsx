import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useMediaQuery } from "react-responsive";
import {
  Volume1Icon,
  Volume2Icon,
  VolumeIcon,
  VolumeXIcon,
} from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { buttonVariants } from "@/components/ui/button";
import { usePlaybackContext } from "@/components/playback-context";
import { setVolume as persistVolume } from "@/features/player/api";
import { usePlayerEngine } from "../player-engine-context";
import {
  DEFAULT_VOLUME,
  VOLUME_SHIFT_STEP,
  VOLUME_STEP,
  clampVolume,
  resolveVolumeIcon,
} from "@/lib/volume";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 300;

function VolumeIconFor({ volume, muted }: { volume: number; muted: boolean }) {
  const state = resolveVolumeIcon(volume, muted);
  if (state === "mute") return <VolumeXIcon className="size-5" />;
  if (state === "low") return <VolumeIcon className="size-5" />;
  if (state === "medium") return <Volume1Icon className="size-5" />;
  return <Volume2Icon className="size-5" />;
}

/**
 * Player-aware volume control. The active browser owns the local engine and
 * persists through the provider; passive devices still write the shared player
 * volume through the API.
 */
export function PlayerVolumeControls() {
  const { t } = useTranslation();
  const { playbackStatus, applyPlaybackStatus } = usePlaybackContext();
  const { isActiveBrowser, volume, muted, setVolume, toggleMute, resetVolume } =
    usePlayerEngine();

  const isTouch = useMediaQuery({ query: "(pointer: coarse)" });
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const anchorRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
  const pointerInsideRef = useRef(false);
  const passiveLastVolumeRef = useRef(DEFAULT_VOLUME);
  const volumeRef = useRef(0);
  const commitRef = useRef<(volume: number) => void>(() => {});

  const displayedVolume = isActiveBrowser ? volume : playbackStatus.volume;
  const isMuted = isActiveBrowser ? muted : displayedVolume === 0;

  useEffect(() => {
    volumeRef.current = displayedVolume;
  }, [displayedVolume]);

  useEffect(() => {
    if (!isActiveBrowser && playbackStatus.volume > 0) {
      passiveLastVolumeRef.current = playbackStatus.volume;
    }
  }, [isActiveBrowser, playbackStatus.volume]);

  const commitVolume = useCallback(
    (next: number) => {
      const clamped = clampVolume(next);
      if (isActiveBrowser) {
        setVolume(clamped);
        return;
      }
      if (clamped > 0) passiveLastVolumeRef.current = clamped;
      void persistVolume(clamped)
        .then(applyPlaybackStatus)
        .catch(() => toast.error(t("player.volumeError")));
    },
    [isActiveBrowser, setVolume, applyPlaybackStatus, t],
  );

  useEffect(() => {
    commitRef.current = commitVolume;
  }, [commitVolume]);

  const toggle = useCallback(() => {
    if (isActiveBrowser) {
      toggleMute();
      return;
    }
    commitVolume(
      displayedVolume > 0 ? 0 : passiveLastVolumeRef.current || DEFAULT_VOLUME,
    );
  }, [isActiveBrowser, toggleMute, commitVolume, displayedVolume]);

  const reset = useCallback(() => {
    if (isActiveBrowser) {
      resetVolume();
      return;
    }
    commitVolume(DEFAULT_VOLUME);
  }, [isActiveBrowser, resetVolume, commitVolume]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    if (draggingRef.current || pointerInsideRef.current) return;
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const openPanel = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  // Wheel on the icon or the panel: non-passive so the page never scrolls.
  useEffect(() => {
    const nodes = [anchorRef.current, contentRef.current].filter(
      (node): node is HTMLButtonElement | HTMLDivElement => node !== null,
    );
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY < 0 ? VOLUME_STEP : -VOLUME_STEP;
      commitRef.current(clampVolume(volumeRef.current + delta));
    };
    for (const node of nodes) {
      node.addEventListener("wheel", handleWheel as EventListener, {
        passive: false,
      });
    }
    return () => {
      for (const node of nodes) {
        node.removeEventListener("wheel", handleWheel as EventListener);
      }
    };
  }, [open]);

  const handleValueChange = useCallback(
    ([next]: number[]) => {
      if (typeof next === "number") commitVolume(next);
    },
    [commitVolume],
  );

  const handleDragStart = useCallback(() => {
    draggingRef.current = true;
    setIsDragging(true);
    clearCloseTimer();
    setOpen(true);
  }, [clearCloseTimer]);

  const handleDragEnd = useCallback(() => {
    draggingRef.current = false;
    setIsDragging(false);
    scheduleClose();
  }, [scheduleClose]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        return;
      }

      let next: number | null = null;
      const step = event.shiftKey ? VOLUME_SHIFT_STEP : VOLUME_STEP;
      if (event.key === "ArrowUp" || event.key === "ArrowRight") {
        next = displayedVolume + step;
      } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
        next = displayedVolume - step;
      } else if (event.key === "Home") {
        next = 0;
      } else if (event.key === "End") {
        next = 100;
      }

      if (next !== null) {
        event.preventDefault();
        event.stopPropagation();
        commitVolume(next);
      }
    },
    [displayedVolume, commitVolume],
  );

  // Touch devices use hardware keys; the desktop bar is the only place this
  // control is rendered.
  if (isTouch) return null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (!next && draggingRef.current) return;
        if (next) openPanel();
        else setOpen(false);
      }}
    >
      <PopoverAnchor asChild>
        <button
          ref={anchorRef}
          type="button"
          aria-label={t("player.volume")}
          aria-pressed={isMuted}
          aria-expanded={open}
          className={cn(
            buttonVariants({ variant: "bare", size: "icon-sm" }),
            "text-muted-foreground hover:text-foreground",
          )}
          onMouseEnter={openPanel}
          onMouseLeave={scheduleClose}
          onFocus={openPanel}
          onBlur={scheduleClose}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            toggle();
          }}
        >
          <VolumeIconFor volume={displayedVolume} muted={isMuted} />
        </button>
      </PopoverAnchor>

      <PopoverContent
        ref={contentRef}
        forceMount
        side="top"
        align="center"
        sideOffset={32}
        role="dialog"
        aria-label={t("player.volume")}
        aria-hidden={!open}
        inert={!open}
        onPointerDownOutside={(event) => {
          const target = event.target as Node | null;
          if (target && anchorRef.current?.contains(target)) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          const target = event.target as Node | null;
          if (target && anchorRef.current?.contains(target)) {
            event.preventDefault();
          }
        }}
        onMouseEnter={() => {
          pointerInsideRef.current = true;
          clearCloseTimer();
        }}
        onMouseLeave={() => {
          pointerInsideRef.current = false;
          scheduleClose();
        }}
        onFocus={openPanel}
        onBlur={scheduleClose}
        className={cn(
          "w-auto p-2 transition-[opacity,transform] duration-150",
          "motion-reduce:transition-none",
          "data-[state=closed]:pointer-events-none data-[state=closed]:scale-95 data-[state=closed]:opacity-0",
          "data-[state=open]:scale-100 data-[state=open]:opacity-100",
        )}
      >
        <div className="relative flex h-[120px] w-10 items-center justify-center">
          {isDragging && (
            <span
              className="bg-popover text-foreground border-border pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded border px-1 py-0.5 text-[10px] tabular-nums shadow-sm"
              style={{ bottom: `calc(${displayedVolume}% + 8px)` }}
              aria-hidden="true"
            >
              {Math.round(displayedVolume)}%
            </span>
          )}
          <Slider
            value={[displayedVolume]}
            min={0}
            max={100}
            step={1}
            orientation="vertical"
            aria-label={t("player.volume")}
            onPointerDown={handleDragStart}
            onPointerUp={handleDragEnd}
            onValueChange={handleValueChange}
            onValueCommit={handleDragEnd}
            onKeyDownCapture={handleKeyDown}
            onDoubleClick={(event) => {
              event.preventDefault();
              reset();
            }}
            className={cn(
              "h-[120px] w-10",
              "[&_[role=slider]]:opacity-0 [&_[role=slider]]:transition-opacity",
              "focus-within:[&_[role=slider]]:opacity-100 hover:[&_[role=slider]]:opacity-100",
              isDragging && "[&_[role=slider]]:opacity-100",
            )}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
