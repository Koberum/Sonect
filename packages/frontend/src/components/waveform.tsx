import { useEffect, useRef, useCallback } from "react";

type WaveformProps = {
  samples: number[];
  progress: number;
  className?: string;
};

function getCssColor(fallback: string, varName: string): string {
  if (typeof window === "undefined") return fallback;
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!val) return fallback;
  // CSS variables in this app are oklch or hsl; canvas can handle oklch in modern browsers
  // If val looks like "0.55 0.15 240" (oklch components without wrapper), wrap it
  if (/^[\d.\s%]+$/.test(val) && val.split(" ").length === 3) {
    return `oklch(${val})`;
  }
  return val;
}

function drawWaveform(
  canvas: HTMLCanvasElement,
  samples: number[],
  progress: number,
  playedColor: string,
  unplayedColor: string,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx || samples.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  if (width === 0 || height === 0) return;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const numBars = Math.min(samples.length, Math.floor(width / 3));
  if (numBars === 0) return;

  const samplesPerBar = Math.max(1, Math.floor(samples.length / numBars));
  const slot = width / numBars;
  const barWidth = Math.max(1.5, slot * 0.65);
  const gap = slot * 0.35;
  const centerY = height / 2;
  const maxSample = Math.max(...samples, 1);

  // Precompute bar heights
  const bars: { x: number; y: number; w: number; h: number; radius: number }[] =
    [];
  for (let i = 0; i < numBars; i++) {
    let maxPeak = 0;
    const startIdx = i * samplesPerBar;
    const endIdx = Math.min(startIdx + samplesPerBar, samples.length);
    for (let j = startIdx; j < endIdx; j++) {
      const norm = samples[j] / maxSample;
      if (norm > maxPeak) maxPeak = norm;
    }
    const barHeight = Math.max(2, maxPeak * height * 0.82);
    const x = i * (barWidth + gap);
    const y = centerY - barHeight / 2;
    const radius = Math.min(barWidth / 2, Math.min(3, barHeight / 2));
    bars.push({ x, y, w: barWidth, h: barHeight, radius });
  }

  const progressPx = Math.max(0, Math.min(width, progress * width));

  // Draw helpers
  const fillBars = (clipLeft: number, clipRight: number, color: string) => {
    if (clipRight <= clipLeft) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipLeft, 0, clipRight - clipLeft, height);
    ctx.clip();
    ctx.fillStyle = color;
    for (const b of bars) {
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(b.x, b.y, b.w, b.h, b.radius);
      } else {
        ctx.rect(b.x, b.y, b.w, b.h);
      }
      ctx.fill();
    }
    ctx.restore();
  };

  fillBars(0, width, unplayedColor);
  fillBars(0, progressPx, playedColor);
}

export function Waveform({
  samples,
  progress,
  className,
}: WaveformProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const played = getCssColor("oklch(0.55 0.2 265)", "--primary");
    const unplayed = getCssColor("oklch(0.7 0 0)", "--muted-foreground");
    // add opacity for unplayed via color alpha if possible: use 35% opacity
    // oklch supports / alpha
    const unplayedFaint = unplayed.includes("oklch")
      ? `${unplayed} / 0.35`
      : unplayed;
    // canvas fillStyle handles oklch with alpha? fallback to rgba if needed
    // try parsing; if oklch unsupported it will fallback to default, which is okay
    drawWaveform(canvas, samples, progress, played, unplayedFaint);
  }, [samples, progress]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => render());
    ro.observe(canvas);
    window.addEventListener("resize", render);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", render);
    };
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-hidden="true"
    />
  );
}
