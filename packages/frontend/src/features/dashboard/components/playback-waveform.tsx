import { goToPosition } from "@/features/player/api";
import { formatTime } from "@/lib/utils";
import type { OutputMode } from "@repo/types";
import { Waveform } from "@/components/waveform";
import { useQuery } from "@tanstack/react-query";
import { playerQueries } from "@/features/player/queries";

type PlaybackWaveformProps = {
  elapsed: number;
  duration: number;
  trackId: number | null;
  className?: string;
  outputMode?: OutputMode;
};

export function PlaybackWaveform({
  elapsed,
  duration,
  trackId,
  className,
  outputMode: _outputMode = "mpd",
}: PlaybackWaveformProps): React.ReactElement {
  void _outputMode;
  const pct = duration > 0 ? Math.min(100, (elapsed / duration) * 100) : 0;
  const { data: waveform } = useQuery(playerQueries.waveform(trackId));
  const hasWaveform =
    waveform != null &&
    Array.isArray(waveform.samples) &&
    waveform.samples.length > 0;

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newPosition = percentage * duration;
    void goToPosition(newPosition);
  };

  return (
    <div className={`flex w-full items-center gap-2 ${className ?? ""}`}>
      <span className="hidden font-mono text-xs md:flex">
        {formatTime(elapsed)}
      </span>

      {hasWaveform ? (
        <div
          className="relative h-5 flex-1 cursor-pointer overflow-hidden rounded-sm"
          role="slider"
          aria-label="Playback position"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={elapsed}
          onClick={handleSeek}
          style={{ minWidth: 0 }}
        >
          <Waveform
            samples={waveform.samples}
            progress={pct / 100}
            className="absolute inset-0 h-full w-full"
          />
        </div>
      ) : (
        <div
          className="bg-border h-1.5 flex-1 cursor-pointer rounded-sm"
          role="slider"
          aria-label="Playback position"
          aria-valuemin={0}
          aria-valuemax={duration || 0}
          aria-valuenow={elapsed}
          onClick={handleSeek}
        >
          <div
            className="bg-primary h-full rounded-sm"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      <span className="hidden font-mono text-xs md:flex">
        {formatTime(duration)}
      </span>
    </div>
  );
}
