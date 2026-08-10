import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function getCoverPath(cover_path?: string) {
  if (cover_path) {
    return `${import.meta.env.VITE_BACKEND_URL ?? ""}${import.meta.env.VITE_COVER_PATH ?? "/covers"}/${cover_path}`;
  }
  return "/default_cover.png";
}

/** Shared hover effect classes for album/track/artist artwork */
export const hoverStyles = "transition-all hover:scale-105 hover:brightness-75";
