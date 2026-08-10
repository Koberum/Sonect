import fs from "fs";

const MPD_LOG_PATH = process.env.MPD_LOG_PATH ?? "/var/lib/mpd/mpd.log";

export function getMpdLogPath(): string {
  return MPD_LOG_PATH;
}

export interface MpdLogLine {
  raw: string;
  filePath: string;
}

const ADDED_PREFIX = "update: added ";

export function parseMpdLogLines(lines: string[]): MpdLogLine[] {
  const result: MpdLogLine[] = [];
  for (const line of lines) {
    const idx = line.indexOf(ADDED_PREFIX);
    if (idx !== -1) {
      result.push({
        raw: line,
        filePath: line.substring(idx + ADDED_PREFIX.length),
      });
    }
  }
  return result;
}

export function readNewMpdLogLines(fromPosition: number): {
  lines: string[];
  newPosition: number;
} {
  try {
    const stats = fs.statSync(MPD_LOG_PATH);

    if (stats.size < fromPosition) {
      fromPosition = 0;
    }

    if (stats.size <= fromPosition) {
      return { lines: [], newPosition: fromPosition };
    }

    const fd = fs.openSync(MPD_LOG_PATH, "r");
    const buf = Buffer.alloc(stats.size - fromPosition);
    fs.readSync(fd, buf, 0, buf.length, fromPosition);
    fs.closeSync(fd);

    const content = buf.toString("utf-8");
    const lines = content.split("\n").filter(Boolean);

    return { lines, newPosition: stats.size };
  } catch {
    return { lines: [], newPosition: fromPosition };
  }
}
