import type { LibrarySyncProgress } from "@repo/types/catalog";

export const SYNC_TOTAL_STEPS = 3;

export type SyncPhaseMeta = {
  labelKey: string;
  step: number;
  determinate: boolean;
};

export function getSyncPhaseMeta(progress: LibrarySyncProgress): SyncPhaseMeta {
  switch (progress.phase) {
    case "scan-started":
      return { labelKey: "sync.preparing", step: 1, determinate: false };
    case "mpd":
      return { labelKey: "sync.scanningLibrary", step: 1, determinate: false };
    case "covers":
      return { labelKey: "sync.readingCovers", step: 3, determinate: true };
    case "tracks":
    default:
      return { labelKey: "sync.readingTracks", step: 2, determinate: true };
  }
}

export function getSyncPercent(progress: LibrarySyncProgress): number | null {
  if (progress.total <= 0) return null;
  return Math.min(
    100,
    Math.max(0, Math.round((progress.current / progress.total) * 100)),
  );
}

export function getSyncItemLabel(progress: LibrarySyncProgress): string | null {
  if (!progress.track) return null;
  return [progress.track.title, progress.track.artist]
    .filter(Boolean)
    .join(" — ");
}
