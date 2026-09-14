import crypto from "crypto";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { tracksDb } from "@repo/db";
import { NotFoundError } from "@middleware/errorHandler";

export interface WaveformData {
  samples: number[];
  duration: number;
  version: number;
}

const DEFAULT_NUM_SAMPLES = 120;
const WAVEFORM_VERSION = 1;

function getWaveformsDir(): string {
  if (process.env.WAVEFORMS_DIR) return process.env.WAVEFORMS_DIR;
  if (process.env.COVERS_DIR) {
    return path.join(path.dirname(process.env.COVERS_DIR), "waveforms");
  }
  return "./data/waveforms";
}

function getWaveformPath(file: string): string {
  const hash = crypto.createHash("sha1").update(file).digest("hex");
  return path.join(getWaveformsDir(), `${hash}.json`);
}

function ensureWaveformsDir(): void {
  const dir = getWaveformsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const memoryCache = new Map<string, WaveformData>();
const pendingGeneration = new Map<string, Promise<WaveformData>>();

export function clearWaveformCache(): void {
  memoryCache.clear();
  pendingGeneration.clear();
}

async function generateFromFile(
  absolutePath: string,
  durationHint: number | null,
): Promise<WaveformData> {
  const exists = fs.existsSync(absolutePath);
  if (!exists) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const rawPcm = await decodeWithFfmpeg(absolutePath);

  if (!rawPcm || rawPcm.length === 0) {
    return fallbackWaveform(durationHint);
  }

  const sampleCount = rawPcm.length / 2;
  const duration =
    durationHint && durationHint > 0 ? durationHint : sampleCount / 8000;

  const samples = extractPeaks(rawPcm, DEFAULT_NUM_SAMPLES);
  return { samples, duration, version: WAVEFORM_VERSION };
}

function decodeWithFfmpeg(filePath: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const args = [
      "-i",
      filePath,
      "-f",
      "s16le",
      "-ac",
      "1",
      "-ar",
      "8000",
      "-acodec",
      "pcm_s16le",
      "-loglevel",
      "error",
      "-",
    ];
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

    proc.on("error", (err: Error & { code?: string }) => {
      if (err.code === "ENOENT") {
        resolve(null);
      } else {
        resolve(null);
      }
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        // ffmpeg failed (e.g. unsupported codec) — caller will use fallback
        if (stderr) {
          // keep quiet unless debugging; do not throw
        }
        resolve(null);
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    // safety timeout 15s per track (Pi could be slow on large FLAC)
    const timer = setTimeout(() => {
      try {
        proc.kill("SIGKILL");
      } catch {
        // ignore
      }
      resolve(null);
    }, 15000);
    proc.on("close", () => clearTimeout(timer));
  });
}

function extractPeaks(rawPcm: Buffer, numPeaks: number): number[] {
  const totalSamples = rawPcm.length / 2;
  if (totalSamples === 0) return new Array(numPeaks).fill(0);

  const step = Math.max(1, Math.floor(totalSamples / numPeaks));
  const samples: number[] = new Array(numPeaks).fill(0);

  for (let i = 0; i < numPeaks; i++) {
    const start = i * step;
    const end = Math.min(start + step, totalSamples);
    let max = 0;
    for (let j = start; j < end; j++) {
      const offset = j * 2;
      const val = rawPcm.readInt16LE(offset);
      const abs = val < 0 ? -val : val;
      if (abs > max) max = abs;
    }
    samples[i] = Math.round((max / 32768) * 255);
  }

  // normalize so max hits 255 for better visual contrast (like monochrome extractPeaks normalizes)
  let maxVal = 0;
  for (const v of samples) if (v > maxVal) maxVal = v;
  if (maxVal > 0 && maxVal < 255) {
    const scale = 255 / maxVal;
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.min(255, Math.round(samples[i] * scale));
    }
  }
  return samples;
}

function fallbackWaveform(durationHint: number | null): WaveformData {
  // gentle pseudo-waveform so UI still shows structure instead of flat line
  const duration = durationHint && durationHint > 0 ? durationHint : 180;
  const samples: number[] = [];
  for (let i = 0; i < DEFAULT_NUM_SAMPLES; i++) {
    const t = i / DEFAULT_NUM_SAMPLES;
    const envelope = Math.sin(Math.PI * t) * 0.6 + 0.4;
    const variation = 0.5 + 0.5 * Math.sin(t * Math.PI * 8);
    samples.push(Math.round(envelope * variation * 180 + 20));
  }
  return { samples, duration, version: WAVEFORM_VERSION };
}

export async function getWaveformForTrack(
  trackId: number,
): Promise<WaveformData> {
  const track = tracksDb.getById(trackId);
  if (!track) {
    throw new NotFoundError(`Track ${trackId} not found`);
  }

  const cacheKey = track.file;

  const cached = memoryCache.get(cacheKey);
  if (cached) return cached;

  const pending = pendingGeneration.get(cacheKey);
  if (pending) return pending;

  const promise = (async (): Promise<WaveformData> => {
    const filePath = getWaveformPath(track.file);

    // try file cache first
    try {
      if (fs.existsSync(filePath)) {
        const raw = await fs.promises.readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw) as WaveformData;
        if (
          Array.isArray(parsed.samples) &&
          parsed.samples.length > 0 &&
          typeof parsed.duration === "number" &&
          parsed.version === WAVEFORM_VERSION
        ) {
          // validate duration roughly matches current DB duration if available
          memoryCache.set(cacheKey, parsed);
          return parsed;
        }
      }
    } catch {
      // corrupt file -> regenerate
    }

    ensureWaveformsDir();

    const musicDir = process.env.MUSIC_DIR ?? "/opt/sonect/music";
    const absolutePath = path.isAbsolute(track.file)
      ? track.file
      : path.join(musicDir, track.file);

    let data: WaveformData;
    try {
      const ffmpegData = await generateFromFile(
        absolutePath,
        track.duration ?? null,
      );
      data = ffmpegData;
    } catch {
      data = fallbackWaveform(track.duration ?? null);
    }

    // if ffmpeg unavailable (null pcm) we already fell back
    if (!data.samples || data.samples.length === 0) {
      data = fallbackWaveform(track.duration ?? null);
    }

    // atomic write
    try {
      const tmpPath = filePath + ".tmp";
      await fs.promises.writeFile(tmpPath, JSON.stringify(data), "utf-8");
      await fs.promises.rename(tmpPath, filePath);
    } catch {
      // write failure is non-fatal — keep memory cache
    }

    memoryCache.set(cacheKey, data);
    return data;
  })();

  pendingGeneration.set(cacheKey, promise);
  try {
    const result = await promise;
    return result;
  } finally {
    pendingGeneration.delete(cacheKey);
  }
}

export function getWaveformFilePathForTrack(file: string): string {
  return getWaveformPath(file);
}

export function getWaveformsDirPath(): string {
  return getWaveformsDir();
}
