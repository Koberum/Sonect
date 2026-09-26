import { apiFetch } from "@/lib/api";
import type { Playlist, PlaylistWithTracks } from "@repo/types/catalog";

export function getPlaylists(signal?: AbortSignal): Promise<Playlist[]> {
  return apiFetch("/playlists/", { signal });
}

export function getPlaylist(
  id: number,
  signal?: AbortSignal,
): Promise<PlaylistWithTracks> {
  return apiFetch(`/playlists/${id}`, { signal });
}

export function createPlaylist(
  name: string,
  description?: string,
): Promise<Playlist> {
  return apiFetch("/playlists/", {
    method: "POST",
    body: { name, description },
  });
}

export function updatePlaylist(
  id: number,
  data: { name?: string; description?: string },
): Promise<Playlist> {
  return apiFetch(`/playlists/${id}`, { method: "PATCH", body: data });
}

export function deletePlaylist(id: number): Promise<void> {
  return apiFetch(`/playlists/${id}`, { method: "DELETE" });
}

export function addTrackToPlaylist(
  playlistId: number,
  trackId: number,
): Promise<{ pt_id: number }> {
  return apiFetch(`/playlists/${playlistId}/tracks`, {
    method: "POST",
    body: { trackId },
  });
}

export function removeTrackFromPlaylist(
  playlistId: number,
  ptId: number,
): Promise<void> {
  return apiFetch(`/playlists/${playlistId}/tracks/${ptId}`, {
    method: "DELETE",
  });
}

export function loadPlaylist(id: number): Promise<void> {
  return apiFetch(`/playlists/${id}/load`, { method: "POST" });
}
