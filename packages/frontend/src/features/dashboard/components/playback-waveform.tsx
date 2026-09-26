import { useState } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
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
  const { data: waveform } = useQuery(playerQueries.waveform(trackId));
  const hasWaveform =
    waveform != null &&
    Array.isArray(waveform.samples) &&
    waveform.samples.length > 0;

  const [preview, setPreview] = useState<number | null>(null);
  const disabled = duration <= 0;
  const display = preview ?? elapsed;
  const pct = duration > 0 ? Math.min(100, (display / duration) * 100) : 0;

  return (
    <div className={`flex w-full items-center gap-2 ${className ?? ""}`}>
      <span className="hidden font-mono text-xs tabular-nums md:flex">
        {formatTime(display)}
      </span>

      {hasWaveform ? (
        <SliderPrimitive.Root
          min={0}
          max={duration || 1}
          step={1}
          value={[Math.min(display, duration) || 0]}
          disabled={disabled}
          onValueChange={([v]) => setPreview(v)}
          onValueCommit={([v]) => {
            setPreview(null);
            void goToPosition(v);
          }}
          className="group relative -my-2 flex flex-1 touch-none items-center py-2 select-none"
          aria-label="Playback position"
          style={{ minWidth: 0 }}
        >
          <SliderPrimitive.Track className="relative h-5 w-full grow overflow-hidden rounded-sm">
            <Waveform
              samples={waveform.samples}
              progress={pct / 100}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
            {/* Range hidden — waveform visualizes progress */}
            <SliderPrimitive.Range className="hidden" />
          </SliderPrimitive.Track>
        </SliderPrimitive.Root>
      ) : (
        <SliderPrimitive.Root
          min={0}
          max={duration || 1}
          step={1}
          value={[Math.min(display, duration) || 0]}
          disabled={disabled}
          onValueChange={([v]) => setPreview(v)}
          onValueCommit={([v]) => {
            setPreview(null);
            void goToPosition(v);
          }}
          className="group relative -my-4 flex flex-1 touch-none items-center py-4 select-none"
          aria-label="Playback position"
        >
          <SliderPrimitive.Track className="bg-border relative h-1.5 w-full grow overflow-hidden rounded-full">
            <SliderPrimitive.Range className="bg-primary absolute h-full" />
          </SliderPrimitive.Track>
          <SliderPrimitive.Thumb className="bg-background border-primary/50 focus-visible:ring-ring block h-3 w-3 rounded-full border opacity-0 shadow transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:ring-1 focus-visible:outline-none data-[disabled]:hidden" />
        </SliderPrimitive.Root>
      )}

      <span className="hidden font-mono text-xs tabular-nums md:flex">
        {formatTime(duration)}
      </span>
    </div>
  );
}
