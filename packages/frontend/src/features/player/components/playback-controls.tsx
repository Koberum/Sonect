import type { PlaybackStatus } from "@repo/types";
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
}: PlaybackControls): React.ReactElement {
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
      <div className="flex items-center gap-2">
        <Button
          variant="bare"
          size="icon-sm"
          className={playbackStatus.random ? btnActive : btnBase}
          onClick={() => {
            setRandom(!playbackStatus.random);
          }}
        >
          <ShuffleIcon className="size-5" />
        </Button>

        <Button
          variant="bare"
          size="icon-sm"
          className={btnBase}
          onClick={previousTrack}
        >
          <SkipBackIcon className="size-5" />
        </Button>

        <Button
          variant="default"
          size="icon-sm"
          className="rounded-full transition-opacity hover:opacity-85"
          onClick={handleMain}
        >
          {playbackStatus.state === "play" ? (
            <PauseIcon className="size-5" fill="currentColor" />
          ) : (
            <PlayIcon className="size-5" fill="currentColor" />
          )}
        </Button>

        <Button
          variant="bare"
          size="icon-sm"
          className={btnBase}
          onClick={nextTrack}
        >
          <SkipForwardIcon className="size-5" />
        </Button>

        <Button
          variant="bare"
          size="icon-sm"
          className={playbackStatus.repeat ? btnActive : btnBase}
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
