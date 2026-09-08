import { playlistsDb, tracksDb, artistsDb, albumsDb, genresDb } from "@repo/db";
import {
  Playlist,
  PlaylistTrack,
  PlaylistWithTracks,
  Track,
} from "@repo/types";
import { mpdConnectionManager } from "./mpdConnectionManager";

export function getAllPlaylists(): Playlist[] {
  return playlistsDb.getAll();
}

export function getPlaylistById(id: number): Playlist | undefined {
  return playlistsDb.getById(id);
}

export function getPlaylistWithTracks(
  id: number,
): PlaylistWithTracks | undefined {
  const playlist = playlistsDb.getById(id);
  if (!playlist) return undefined;

  const rawTracks = playlistsDb.getTracks(id);
  const tracks: PlaylistTrack[] = rawTracks.map((t: any) => {
    const artist = t.artist_id ? artistsDb.getById(t.artist_id) : undefined;
    const album = t.album_id ? albumsDb.getById(t.album_id) : undefined;
    return {
      id: t.id,
      file: t.file,
      title: t.title,
      artist_name: artist?.name ?? "",
      cover_path: album?.cover_path ?? "",
      track_number: t.track_number,
      disc_number: t.disc_number,
      duration: t.duration,
      date: t.date,
      genre:
        (t as any).genre ??
        (t.genre_id ? genresDb.getById(t.genre_id)?.name : undefined) ??
        album?.genre ??
        undefined,
      pt_id: t.pt_id,
      position: t.position,
    } as Track & { pt_id: number; position: number };
  });

  return { ...playlist, tracks };
}

export function createPlaylist(
  name: string,
  description?: string,
): Playlist | undefined {
  const id = playlistsDb.create(name, description);
  return playlistsDb.getById(id);
}

export function updatePlaylist(
  id: number,
  data: { name?: string; description?: string },
): Playlist | undefined {
  const playlist = playlistsDb.getById(id);
  if (!playlist) return undefined;

  const oldName = playlist.name;
  playlistsDb.update(id, data);

  if (data.name && data.name !== oldName) {
    mpdConnectionManager
      .executeCommand("rename", [oldName, data.name])
      .catch(() => {});
  }

  return playlistsDb.getById(id);
}

export function deletePlaylist(id: number): boolean {
  const playlist = playlistsDb.getById(id);
  if (!playlist) return false;

  playlistsDb.delete(id);
  mpdConnectionManager.executeCommand("rm", [playlist.name]).catch(() => {});
  return true;
}

export function addTrackToPlaylist(
  playlistId: number,
  trackId: number,
): { pt_id: number } | null {
  const track = tracksDb.getById(trackId);
  if (!track) throw new Error("Track not found");

  const playlist = playlistsDb.getById(playlistId);
  if (!playlist) throw new Error("Playlist not found");

  playlistsDb.addTrack(playlistId, trackId);

  mpdConnectionManager
    .executeCommand("playlistadd", [playlist.name, track.file])
    .catch(() => {});

  const tracks = playlistsDb.getTracks(playlistId) as any[];
  const added = tracks.find((t: any) => t.file === track.file);
  return added ? { pt_id: added.pt_id } : null;
}

export function removeTrackFromPlaylist(
  playlistTrackId: number,
  playlistId: number,
): boolean {
  const tracks = playlistsDb.getTracks(playlistId) as any[];
  const track = tracks.find((t: any) => t.pt_id === playlistTrackId);
  if (!track) return false;

  const playlist = playlistsDb.getById(playlistId);

  playlistsDb.removeTrack(playlistTrackId);

  if (playlist) {
    removeTrackFromMpdPlaylist(playlist.name, track.file).catch(() => {});
  }
  return true;
}

export async function loadPlaylist(id: number): Promise<void> {
  const playlist = playlistsDb.getById(id);
  if (!playlist) throw new Error("Playlist not found");

  await mpdConnectionManager.executeCommand("clear");
  await mpdConnectionManager.executeCommand("load", [playlist.name]);
  mpdConnectionManager.refreshNow().catch(() => {});
}

async function removeTrackFromMpdPlaylist(
  playlistName: string,
  trackFile: string,
): Promise<void> {
  try {
    const raw = await mpdConnectionManager.executeCommand("listplaylistinfo", [
      playlistName,
    ]);
    const lines = raw.split("\n");
    let pos = 0;
    for (const line of lines) {
      if (line.startsWith("file: ") && line.slice(6) === trackFile) {
        await mpdConnectionManager.executeCommand("playlistdelete", [
          playlistName,
          pos.toString(),
        ]);
        return;
      }
      if (line.startsWith("file: ")) pos++;
    }
  } catch {
    // MPD playlist may not exist yet
  }
}
