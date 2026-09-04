import { goToPosition } from "@/features/apis/mpdApis";
import { formatTime } from "@/lib/utils";

type PlaybackProgressBar = {
  elapsed: number;
  duration: number;
  className?: string;
};

export function PlaybackProgressBar({
  elapsed,
  duration,
  className,
}: PlaybackProgressBar): React.ReactElement {
  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;

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
          goToPosition(newPosition);
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
