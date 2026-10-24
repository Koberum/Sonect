import { apiFetch } from "@/lib/api";
import type { AuthProfile, AuthState, PublicProfile } from "@repo/types";

export const getAuthState = (signal?: AbortSignal): Promise<AuthState> =>
  apiFetch<AuthState>("/auth/state", { signal });

export const listPublicProfiles = (
  signal?: AbortSignal,
): Promise<PublicProfile[]> =>
  apiFetch<PublicProfile[]>("/auth/profiles", { signal });

export const bootstrapAdmin = (input: {
  name: string;
  password: string;
}): Promise<{ profile: AuthProfile }> =>
  apiFetch("/auth/bootstrap", { method: "POST", body: input });

export const login = (input: {
  profileId: string;
  password: string;
}): Promise<{ profile: AuthProfile }> =>
  apiFetch("/auth/login", { method: "POST", body: input });

export const logout = (): Promise<void> =>
  apiFetch<void>("/auth/logout", { method: "POST" });

export const switchProfile = (input: {
  profileId: string;
  password: string;
}): Promise<{ profile: AuthProfile }> =>
  apiFetch("/auth/switch", { method: "POST", body: input });

export const changePassword = (input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> =>
  apiFetch<void>("/auth/password", { method: "POST", body: input });
