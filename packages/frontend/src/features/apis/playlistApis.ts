import { ApiClient } from "@/lib/apiClient";
import type { Playlist, PlaylistWithTracks } from "@repo/types/catalog";

const apiClient = new ApiClient({
  baseUrl: `${import.meta.env.VITE_BACKEND_URL ?? ""}/playlists`,
});

export const getPlaylists = async (): Promise<Playlist[]> => {
  return apiClient.get("/");
};

export const getPlaylist = async (id: number): Promise<PlaylistWithTracks> => {
  return apiClient.get(`/${id}`);
};

export const createPlaylist = async (
  name: string,
  description?: string,
): Promise<Playlist> => {
  return apiClient.post("/", { name, description });
};

export const updatePlaylist = async (
  id: number,
  data: { name?: string; description?: string },
): Promise<Playlist> => {
  return apiClient.patch(`/${id}`, data);
};

export const deletePlaylist = async (id: number): Promise<void> => {
  return apiClient.delete(`/${id}`);
};

export const addTrackToPlaylist = async (
  playlistId: number,
  trackId: number,
): Promise<{ pt_id: number }> => {
  return apiClient.post(`/${playlistId}/tracks`, { trackId });
};

export const removeTrackFromPlaylist = async (
  playlistId: number,
  ptId: number,
): Promise<void> => {
  return apiClient.delete(`/${playlistId}/tracks/${ptId}`);
};

export const loadPlaylist = async (id: number): Promise<void> => {
  return apiClient.post(`/${id}/load`);
};
