import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { tracksDb } from "@repo/db";

const MIME_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".opus": "audio/opus",
  ".aac": "audio/aac",
  ".wma": "audio/x-ms-wma",
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

  const ext = path.extname(safePath);
  const contentType = getContentType(ext);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize) {
      res.status(416).set("Content-Range", `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(safePath, { start, end });

    res.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunkSize,
      "Content-Type": contentType,
      "Cache-Control": "no-cache",
    });
    pipeFileSafely(res, stream);
  } else {
    const stream = fs.createReadStream(safePath);

    res.writeHead(200, {
      "Content-Length": fileSize,
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });
    pipeFileSafely(res, stream);
  }
}

function pipeFileSafely(res: Response, stream: fs.ReadStream): void {
  stream.on("error", () => {
    res.end();
  });
  stream.pipe(res);
}
