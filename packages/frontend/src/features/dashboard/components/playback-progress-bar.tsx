import { goToPosition } from "@/features/player/api";
import { formatTime } from "@/lib/utils";
import type { OutputMode } from "@repo/types";

type PlaybackProgressBar = {
  elapsed: number;
  duration: number;
  className?: string;
  outputMode?: OutputMode;
};

export function PlaybackProgressBar({
  elapsed,
  duration,
  className,
  outputMode: _outputMode = "mpd",
}: PlaybackProgressBar): React.ReactElement {
  void _outputMode;
  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const seek = goToPosition;

  return (
    <div className={`flex w-full items-center gap-2 ${className}`}>
      <span className="hidden font-mono text-xs md:flex">
        {formatTime(elapsed)}
      </span>

      <div
        className="bg-border h-1.5 flex-1 cursor-pointer rounded-sm"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const percentage = x / rect.width;
          const newPosition = percentage * duration;
          seek(newPosition);
        }}
      >
        <div
          className="bg-primary h-full rounded-sm"
          style={{ width: `${pct}%` }}
        />
      </div>

      <span className="hidden font-mono text-xs md:flex">
        {formatTime(duration)}
      </span>
    </div>
  );
}
