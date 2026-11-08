import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getCoverPath(cover_path?: string) {
  if (cover_path) {
    return `${import.meta.env.VITE_BACKEND_URL ?? ""}${import.meta.env.VITE_COVER_PATH ?? "/covers"}/${cover_path}`;
  }
  return "/default_cover.webp";
}

/** Extract a 4-digit year from an MPD/ID3 date such as "2021-05-01". */
export function parseYear(date?: string): string | undefined {
  if (!date) return undefined;
  return date.match(/\b(\d{4})\b/)?.[1] ?? date.match(/^(\d{4})/)?.[1];
}

/** Shared hover effect classes for album/track/artist artwork */
export const hoverStyles = "transition-all hover:scale-105 hover:brightness-75";
