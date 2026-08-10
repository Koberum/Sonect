import {
  MPDEntity,
  MPDEntityType,
  MPDTrack,
  MPDQueuedTrack,
} from "@repo/types";

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

export function parseEntities(msg: string): MPDEntity[] {
  const entityKeys: Record<string, MPDEntityType> = {
    file: "file",
    directory: "directory",
    playlist: "playlist",
    song: "song",
  };

  const lines = msg.split("\n");
  const items: MPDEntity[] = [];
  let current: MPDEntity | null = null;

  for (const line of lines) {
    if (!line || line === "OK") continue;

    const idx = line.indexOf(": ");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim().toLocaleLowerCase();
    const value = line.slice(idx + 2).trim();

    if (entityKeys[key]) {
      if (current) items.push(current);
      current = { type: entityKeys[key] };

      if (key === "file" || key === "directory") current.path = value;
      else if (key === "playlist") current.name = value;
      else current[key] = value;

      continue;
    }

    if (!current) current = { type: "generic" };

    if (key === "Time" || key === "duration") current[key] = Number(value);
    else current[key] = value;
  }

  if (current) items.push(current);

  return items;
}

export function parseMPDMessageToTracks(msg: string): MPDTrack[] {
  const entities = parseEntities(msg);

  return entities
    .filter((entity) => entity.type === "file")
    .map((entity) => ({
      file: entity.path || "",
      title: entity.title,
      artist: entity.artist,
      album: entity.album,
      albumArtist: entity.albumartist,
      genre: entity.genre,
      track: entity.track ? parseInt(entity.track.toString()) : undefined,
      date: entity.date,
      composer: entity.composer,
      performer: entity.performer,
      disc: entity.disc,
      duration: entity.duration,
      lastModified: entity["last-modified"],
    }));
}

export function parseMPDMessageToQueuedTracks(msg: string): MPDQueuedTrack[] {
  const entities = parseEntities(msg);

  return entities
    .filter((entity) => entity.type === "file")
    .map((entity) => ({
      file: entity.path || "",
      title: entity.title,
      artist: entity.artist,
      album: entity.album,
      albumArtist: entity.albumartist,
      genre: entity.genre,
      track: entity.track ? parseInt(entity.track.toString()) : undefined,
      date: entity.date,
      composer: entity.composer,
      performer: entity.performer,
      disc: entity.disc,
      duration: entity.duration,
      lastModified: entity["last-modified"],
      pos: parseInt(entity.pos?.toString() || "0"),
      id: parseInt(entity.id?.toString() || "0"),
    }));
}
