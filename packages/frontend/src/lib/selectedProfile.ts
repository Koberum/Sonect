import type { Profile } from "@repo/types";

export type SelectedProfile = Pick<Profile, "id" | "name" | "avatarColor">;

export type { Profile };

export const AVATAR_COLORS = [
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#eab308",
  "#ef4444",
] as const;

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function toSelectedProfile(profile: Profile): SelectedProfile {
  return {
    id: profile.id,
    name: profile.name,
    avatarColor: profile.avatarColor,
  };
}

const STORAGE_KEY = "sonect-profile";
const LEGACY_KEY = "sonect.sessionId";

function isSelectedProfile(value: unknown): value is SelectedProfile {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    c.id.length > 0 &&
    typeof c.name === "string" &&
    typeof c.avatarColor === "string"
  );
}

export function getSelectedProfile(): SelectedProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isSelectedProfile(parsed)) return parsed;
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  // Migration: legacy random sessionId has no profile; don't auto-convert
  return null;
}

export function setSelectedProfile(profile: SelectedProfile): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  // Keep X-Session-Id key in sync so existing code that reads it still works until removed
  localStorage.setItem(LEGACY_KEY, profile.id);
}

export function clearSelectedProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getProfileSessionId(): string {
  return getSelectedProfile()?.id ?? "";
}

export function profileSessionHeaders(): Record<string, string> {
  const id = getProfileSessionId();
  return id ? { "X-Session-Id": id } : {};
}
