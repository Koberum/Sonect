import { apiFetch } from "@/lib/api";
import type { DBProfile } from "@repo/types";

export const listProfiles = (signal?: AbortSignal): Promise<DBProfile[]> =>
  apiFetch<DBProfile[]>("/profiles", { signal });

export const createProfile = (
  name: string,
  avatarColor?: string,
): Promise<DBProfile> =>
  apiFetch<DBProfile>("/profiles", {
    method: "POST",
    body: { name, avatarColor },
  });

export const updateProfile = (
  id: string,
  data: { name?: string; avatarColor?: string },
): Promise<DBProfile> =>
  apiFetch<DBProfile>(`/profiles/${id}`, { method: "PATCH", body: data });

export const deleteProfile = (id: string): Promise<void> =>
  apiFetch<void>(`/profiles/${id}`, { method: "DELETE" });
