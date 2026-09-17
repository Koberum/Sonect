import { apiFetch } from "@/lib/api";
import type { Profile } from "@repo/types";

export const listProfiles = (signal?: AbortSignal): Promise<Profile[]> =>
  apiFetch<Profile[]>("/profiles", { signal });

export const createProfile = (
  name: string,
  avatarColor?: string,
): Promise<Profile> =>
  apiFetch<Profile>("/profiles", {
    method: "POST",
    body: { name, avatarColor },
  });

export const updateProfile = (
  id: string,
  data: { name?: string; avatarColor?: string },
): Promise<Profile> =>
  apiFetch<Profile>(`/profiles/${id}`, { method: "PATCH", body: data });

export const deleteProfile = (id: string): Promise<void> =>
  apiFetch<void>(`/profiles/${id}`, { method: "DELETE" });
