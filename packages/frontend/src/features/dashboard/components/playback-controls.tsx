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
  nextTrack(): void;
  previousTrack(): void;
  setRandom(status: boolean): void;
  setRepeat(status: boolean): void;
  className?: string;
  showAllControls?: boolean;
};

export function PlaybackControls({
  playbackStatus,
  playTrack,
  pauseTrack,
  nextTrack,
  previousTrack,
  setRandom,
  setRepeat,
  className,
  showAllControls,
}: PlaybackControls): React.ReactElement {
  const btnBase =
    "text-muted-foreground hover:text-foreground transition-colors p-1";
  const btnActive = "text-primary hover:text-primary";
  const showAlways = showAllControls ? "" : "hidden md:block";

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className={`${showAlways} ${playbackStatus.random ? btnActive : btnBase}`}
          onClick={() => {
            setRandom(!playbackStatus.random);
          }}
        >
          <ShuffleIcon size={20} />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className={`${showAlways} ${btnBase}`}
          onClick={previousTrack}
        >
          <SkipBackIcon size={20} />
        </Button>

        <Button
          variant="default"
          size="icon-lg"
          className="rounded-full transition-opacity hover:opacity-85"
          onClick={playbackStatus.state === "stop" ? playTrack : pauseTrack}
        >
          {playbackStatus.state === "play" ? (
            <PauseIcon size={20} fill="currentColor" />
          ) : (
            <PlayIcon size={20} fill="currentColor" />
          )}
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className={`${showAlways} ${btnBase}`}
          onClick={nextTrack}
        >
          <SkipForwardIcon size={20} />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className={`${showAlways} ${playbackStatus.repeat ? btnActive : btnBase}`}
          onClick={() => {
            setRepeat(!playbackStatus.repeat);
          }}
        >
          <RepeatIcon size={20} />
        </Button>
      </div>
    </div>
  );
}
