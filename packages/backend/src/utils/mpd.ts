import type { MPDTrack } from "@repo/types";

export function parseKeyValue(msg: string): Record<string, string> {
  const data: Record<string, string> = {};
  for (const line of msg.split("\n")) {
    const idx = line.indexOf(": ");
    if (idx !== -1) {
      data[line.slice(0, idx)] = line.slice(idx + 2);
    }
  }
  return data;
}

export function hashFile(file: string): number {
  let hash = 0;
  for (let i = 0; i < file.length; i++) {
    hash = (hash << 5) - hash + file.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Parse the song records returned by `find` / `listallinfo`.
 *
 * MPD emits one `file:` record per song, followed by tag lines (and an
 * optional `directory:` record for listallinfo). The first value wins for
 * multi-valued tags so the catalog stays deterministic; `Time` is a fallback
 * for older MPD versions that do not emit `duration`.
 */
export function parseMPDTracks(msg: string): MPDTrack[] {
  const tracks: MPDTrack[] = [];
  let current: MPDTrack | null = null;
  let currentTime: number | undefined;

  const pushCurrent = (): void => {
    if (!current) return;
    if (current.duration === undefined && currentTime !== undefined) {
      current.duration = currentTime;
    }
    if (current.file) tracks.push(current);
    current = null;
    currentTime = undefined;
  };

  const setFirst = (
    key: "title" | "artist" | "album" | "albumArtist" | "genre" | "date",
    value: string,
  ): void => {
    if (!current || current[key] !== undefined || value === "") return;
    current[key] = value;
  };

  for (const line of msg.split("\n")) {
    if (line === "" || line === "OK") continue;
    const idx = line.indexOf(": ");
    if (idx === -1) continue;

    const key = line.slice(0, idx);
    const value = line.slice(idx + 2);

    if (key === "file") {
      pushCurrent();
      current = { file: value };
      continue;
    }

    if (key === "directory" || key === "playlist") {
      pushCurrent();
      continue;
    }

    if (!current) continue;

    switch (key) {
      case "Title":
        setFirst("title", value);
        break;
      case "Artist":
        setFirst("artist", value);
        break;
      case "Album":
        setFirst("album", value);
        break;
      case "AlbumArtist":
        setFirst("albumArtist", value);
        break;
      case "Genre":
        setFirst("genre", value);
        break;
      case "Date":
        setFirst("date", value);
        break;
      case "Disc":
        if (current.disc === undefined && value !== "") current.disc = value;
        break;
      case "Track": {
        if (current.track !== undefined || value === "") break;
        const track = Number.parseInt(value, 10);
        if (!Number.isNaN(track)) current.track = track;
        break;
      }
      case "Time": {
        const time = Number(value);
        if (!Number.isNaN(time)) currentTime = time;
        break;
      }
      case "duration": {
        const duration = Number(value);
        if (!Number.isNaN(duration)) current.duration = duration;
        break;
      }
      case "Last-Modified":
        if (current.lastModified === undefined && value !== "") {
          current.lastModified = value;
        }
        break;
      case "Format":
        if (current.format === undefined && value !== "") {
          current.format = value;
        }
        break;
      default:
        break;
    }
  }

  pushCurrent();
  return tracks;
}
