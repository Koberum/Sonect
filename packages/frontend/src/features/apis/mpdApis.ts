import { ApiClient } from "@/lib/apiClient";
import type { QueuedTrack, Track } from "@repo/types";

const apiClient = new ApiClient({
  baseUrl: `${import.meta.env.VITE_BACKEND_URL ?? ""}/mpd`,
});

export const playSong = async (track: Track) => {
  return apiClient.post("/play", { file: track.file });
};

export const pauseSong = async () => {
  apiClient.post("/pause", {});
};

export const nextTrack = async () => {
  apiClient.post("/next", {});
};

export const previousTrack = async () => {
  apiClient.post("/previous", {});
};

export const setRandom = async (enabled: boolean) => {
  apiClient.post("/random", { enabled: enabled });
};

export const setRepeat = async (enabled: boolean) => {
  apiClient.post("/repeat", { enabled: enabled });
};

export const goToPosition = async (position: number) => {
  apiClient.post("/position", { position });
};

export const setVolume = async (volume: number) => {
  apiClient.patch("/volume", { volume });
};

export const getQueue = async (): Promise<QueuedTrack[]> => {
  return apiClient.get("/queue");
};

export const playQueueItem = async (pos: number) => {
  return apiClient.post("/play-position", { pos });
};

export const removeFromQueue = async (pos: number) => {
  return apiClient.post("/remove-from-queue", { pos });
};

export const addToQueue = async (file: string) => {
  return apiClient.post("/add-to-queue", { file });
};
