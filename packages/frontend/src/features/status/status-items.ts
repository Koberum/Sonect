import type { LibrarySyncProgress } from "@repo/types/catalog";
import { getSyncPercent, getSyncPhaseMeta } from "@/features/sync/sync-phase";
import type { AudioDevice, StorageSource } from "@/features/system/api";
import type { StatusItem, StatusTone } from "./types";

export interface StatusInputs {
  syncProgress: LibrarySyncProgress | null;
  syncError: string | null;
  /** True only after the WebSocket has been down past the grace period. */
  disconnected: boolean;
  isAdmin: boolean;
  storageSources?: StorageSource[];
  audioStatus?: { card: string; name: string } | null;
  audioDevices?: AudioDevice[];
  mpdRunning?: boolean;
}

const TONE_RANK: Record<StatusTone, number> = {
  error: 0,
  warning: 1,
  activity: 2,
};

const OPEN_LIBRARIES = {
  kind: "navigate" as const,
  labelKey: "status.actions.openLibraries",
  to: "/settings",
  state: { tab: "libraries" },
};

const OPEN_AUDIO = {
  kind: "navigate" as const,
  labelKey: "status.actions.openAudio",
  to: "/settings",
  state: { tab: "audio" },
};

/**
 * Pure priority model for the sidebar status center. The UI only translates
 * keys and renders; all source-specific rules live here so they can be tested
 * without React or a browser.
 */
export function buildStatusItems(input: StatusInputs): StatusItem[] {
  const items: StatusItem[] = [];

  if (input.isAdmin && input.storageSources) {
    const unavailable = input.storageSources.filter(
      (source) => source.enabled !== 0 && source.available === false,
    );
    if (unavailable.length > 0) {
      items.push({
        id: "storage",
        tone: "error",
        titleKey: "status.storage.unavailable",
        description: unavailable.map((source) => source.name).join(", "),
        action: OPEN_LIBRARIES,
      });
    }
  }

  if (input.isAdmin && input.audioStatus) {
    if (input.audioDevices && input.audioDevices.length === 0) {
      items.push({
        id: "audio-devices",
        tone: "warning",
        titleKey: "status.audio.noDevices",
        action: OPEN_AUDIO,
      });
    } else if (
      input.audioDevices &&
      !input.audioDevices.some(
        (device) => device.card === input.audioStatus?.card,
      )
    ) {
      items.push({
        id: "audio-output",
        tone: "error",
        titleKey: "status.audio.outputMissing",
        description: input.audioStatus.name,
        action: OPEN_AUDIO,
      });
    }

    if (input.mpdRunning === false) {
      items.push({
        id: "audio-engine",
        tone: "error",
        titleKey: "status.audio.engineOffline",
        action: OPEN_AUDIO,
      });
    }
  }

  if (input.syncError) {
    items.push({
      id: "sync",
      tone: "error",
      titleKey: "sync.failed",
      description: input.isAdmin ? input.syncError : undefined,
      action: input.isAdmin
        ? { kind: "sync", labelKey: "sync.retry" }
        : undefined,
    });
  } else if (input.syncProgress) {
    items.push({
      id: "sync",
      tone: "activity",
      titleKey: getSyncPhaseMeta(input.syncProgress).labelKey,
      descriptionKey: "sync.runningDescription",
      progress: getSyncPercent(input.syncProgress),
      animated: true,
    });
  }

  if (input.disconnected) {
    items.push({
      id: "connection",
      tone: "warning",
      titleKey: "status.connection.lost",
      descriptionKey: "status.connection.description",
      animated: true,
    });
  }

  return items.sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
}
