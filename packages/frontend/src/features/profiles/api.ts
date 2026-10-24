import { apiFetch } from "@/lib/api";
import type { Profile, ProfileRole } from "@repo/types";

export const listProfiles = (signal?: AbortSignal): Promise<Profile[]> =>
  apiFetch<Profile[]>("/profiles", { signal });

export const createProfile = (input: {
  name: string;
  avatarColor?: string;
  password: string;
  role?: ProfileRole;
}): Promise<Profile> =>
  apiFetch<Profile>("/profiles", { method: "POST", body: input });

export const updateProfile = (
  id: string,
  data: { name?: string; avatarColor?: string; role?: ProfileRole },
): Promise<Profile> =>
  apiFetch<Profile>(`/profiles/${id}`, { method: "PATCH", body: data });

export const resetProfilePassword = (
  id: string,
  password: string,
): Promise<void> =>
  apiFetch<void>(`/profiles/${id}/password`, {
    method: "POST",
    body: { password },
  });

export const deleteProfile = (id: string): Promise<void> =>
  apiFetch<void>(`/profiles/${id}`, { method: "DELETE" });
