import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { tracksDb } from "@repo/db";

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".m4b": "audio/mp4",
  ".mp4": "audio/mp4",
  ".opus": "audio/opus",
  ".aac": "audio/aac",
  ".wma": "audio/x-ms-wma",
  ".aiff": "audio/aiff",
  ".aif": "audio/aiff",
  ".wv": "audio/x-wavpack",
  ".ape": "audio/x-ape",
  ".dsf": "audio/x-dsf",
  ".dff": "audio/x-dff",
  ".mpc": "audio/x-musepack",
  ".tta": "audio/x-tta",
};

function getContentType(ext: string): string {
  return MIME_TYPES[ext.toLowerCase()] || "application/octet-stream";
}

function getMusicDir(): string {
  return process.env.MUSIC_DIR || "/music";
}

function resolveTrackPath(filepath: string): string | null {
  const musicDir = path.resolve(getMusicDir());
  const safePath = path.resolve(musicDir, filepath);
  const relative = path.relative(musicDir, safePath);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    return null;
  }
  return safePath;
}

type RangeResult = { start: number; end: number } | "ignore" | "invalid";

/**
 * Parses a single-range `Range` header. Multi-range requests are ignored (the
 * full file is served) and malformed/unsatisfiable ones are reported as
 * invalid so the caller can answer 416.
 */
export function parseRangeHeader(header: string, size: number): RangeResult {
  if (size <= 0) return "invalid";
  const match = /^bytes=(.+)$/i.exec(header.trim());
  if (!match) return "invalid";
  const spec = match[1].trim();
  if (spec.includes(",")) return "ignore";

  const dash = spec.indexOf("-");
  if (dash === -1) return "invalid";
  const rawStart = spec.slice(0, dash).trim();
  const rawEnd = spec.slice(dash + 1).trim();

  if (rawStart === "" && rawEnd === "") return "invalid";

  if (rawStart === "") {
    if (!/^\d+$/.test(rawEnd)) return "invalid";
    const suffix = Number(rawEnd);
    if (suffix <= 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  if (!/^\d+$/.test(rawStart)) return "invalid";
  const start = Number(rawStart);
  if (start >= size) return "invalid";

  let end = size - 1;
  if (rawEnd !== "") {
    if (!/^\d+$/.test(rawEnd)) return "invalid";
    end = Number(rawEnd);
    if (end < start) return "invalid";
    end = Math.min(end, size - 1);
  }

  return { start, end };
}

function buildValidators(stat: fs.Stats): {
  etag: string;
  lastModified: string;
} {
  return {
    etag: `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`,
    lastModified: stat.mtime.toUTCString(),
  };
}

function setCommonHeaders(
  res: Response,
  contentType: string,
  etag: string,
  lastModified: string,
): void {
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);
  res.setHeader("ETag", etag);
  res.setHeader("Last-Modified", lastModified);
  res.setHeader("Cache-Control", "private, max-age=3600");
}

function pipeFileSafely(
  req: Request,
  res: Response,
  stream: fs.ReadStream,
): void {
  const destroyStream = () => {
    if (!stream.destroyed) stream.destroy();
  };
  res.on("close", destroyStream);
  req.on("aborted", destroyStream);

  stream.on("error", () => {
    if (res.headersSent) {
      res.destroy();
    } else {
      res.status(500).json({ error: "Failed to read file" });
    }
  });
  stream.pipe(res);
}

export async function streamHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const rawId = req.params.trackId;
  if (typeof rawId !== "string" || !/^\d+$/.test(rawId)) {
    res.status(400).json({ error: "Invalid track id" });
    return;
  }

  const track = tracksDb.getById(Number(rawId));
  if (!track) {
    res.status(404).json({ error: "Track not found" });
    return;
  }

  const safePath = resolveTrackPath(track.file);
  if (!safePath) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(safePath);
  } catch {
    res.status(404).json({ error: "File not found" });
    return;
  }

  if (!stat.isFile()) {
    res.status(404).json({ error: "Not a file" });
    return;
  }

  const contentType = getContentType(path.extname(safePath));
  const fileSize = stat.size;
  const { etag, lastModified } = buildValidators(stat);
  setCommonHeaders(res, contentType, etag, lastModified);

  const ifNoneMatch = req.headers["if-none-match"];
  if (
    ifNoneMatch &&
    (ifNoneMatch === "*" ||
      ifNoneMatch
        .split(",")
        .map((value) => value.trim())
        .includes(etag))
  ) {
    res.status(304).end();
    return;
  }

  const rangeHeader = req.headers.range;
  const ifRange = req.headers["if-range"];
  const rangeAllowed = !ifRange || ifRange === etag || ifRange === lastModified;
  const parsed =
    rangeHeader && rangeAllowed
      ? parseRangeHeader(rangeHeader, fileSize)
      : ("ignore" as const);

  if (parsed === "invalid") {
    res.setHeader("Content-Range", `bytes */${fileSize}`);
    res.status(416).end();
    return;
  }

  if (parsed === "ignore" || fileSize === 0) {
    res.setHeader("Content-Length", String(fileSize));
    res.status(200);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    pipeFileSafely(req, res, fs.createReadStream(safePath));
    return;
  }

  const { start, end } = parsed;
  const chunkSize = end - start + 1;
  res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
  res.setHeader("Content-Length", String(chunkSize));
  res.status(206);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  pipeFileSafely(req, res, fs.createReadStream(safePath, { start, end }));
}
