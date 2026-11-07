import type { PlaybackStatus } from "@repo/types";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  PauseIcon,
  PlayIcon,
  ShuffleIcon,
  SkipBackIcon,
  SkipForwardIcon,
  RepeatIcon,
} from "lucide-react";

type PlaybackControls = {
  playbackStatus: PlaybackStatus;
  playTrack(): void;
  pauseTrack(): void;
  resumeTrack(): void;
  nextTrack(): void;
  previousTrack(): void;
  setRandom(status: boolean): void;
  setRepeat(status: boolean): void;
  className?: string;
  size?: "default" | "large";
};

export function PlaybackControls({
  playbackStatus,
  playTrack,
  pauseTrack,
  resumeTrack,
  nextTrack,
  previousTrack,
  setRandom,
  setRepeat,
  className,
  size = "default",
}: PlaybackControls): React.ReactElement {
  const { t } = useTranslation();
  const isLarge = size === "large";
  const actionSize = isLarge ? "icon-lg" : "icon-sm";
  const mainIcon = isLarge ? "size-7" : "size-5";
  const btnBase =
    "text-muted-foreground hover:text-foreground transition-colors p-1";
  const btnActive = "text-primary hover:text-primary";

  const handleMain = () => {
    if (playbackStatus.state === "play") return pauseTrack();
    if (playbackStatus.state === "pause") return resumeTrack();
    return playTrack();
  };

  return (
    <div className={className}>
      <div
        className={
          isLarge ? "flex items-center gap-3" : "flex items-center gap-2"
        }
      >
        <Button
          variant="bare"
          size={actionSize}
          className={playbackStatus.random ? btnActive : btnBase}
          aria-label={t("player.shuffle")}
          onClick={() => {
            setRandom(!playbackStatus.random);
          }}
        >
          <ShuffleIcon className="size-5" />
        </Button>

        <Button
          variant="bare"
          size={actionSize}
          className={btnBase}
          aria-label={t("player.previous")}
          onClick={previousTrack}
        >
          <SkipBackIcon className="size-5" />
        </Button>

        <Button
          variant="default"
          size={isLarge ? "icon-lg" : "icon-sm"}
          className={
            isLarge
              ? "size-14 rounded-full transition-opacity hover:opacity-85"
              : "rounded-full transition-opacity hover:opacity-85"
          }
          aria-label={
            playbackStatus.state === "play"
              ? t("player.pause")
              : t("player.play")
          }
          onClick={handleMain}
        >
          {playbackStatus.state === "play" ? (
            <PauseIcon className={mainIcon} fill="currentColor" />
          ) : (
            <PlayIcon className={mainIcon} fill="currentColor" />
          )}
        </Button>

        <Button
          variant="bare"
          size={actionSize}
          className={btnBase}
          aria-label={t("player.next")}
          onClick={nextTrack}
        >
          <SkipForwardIcon className="size-5" />
        </Button>

        <Button
          variant="bare"
          size={actionSize}
          className={playbackStatus.repeat ? btnActive : btnBase}
          aria-label={t("player.repeat")}
          onClick={() => {
            setRepeat(!playbackStatus.repeat);
          }}
        >
          <RepeatIcon className="size-5" />
        </Button>
      </div>
    </div>
  );
}
