export const DEFAULT_VOLUME = 65;
export const VOLUME_STEP = 5;
export const VOLUME_SHIFT_STEP = 1;
export const VOLUME_STORAGE_KEY = "sonect.volume";

export type VolumeIconState = "mute" | "low" | "medium" | "high";

export type VolumePreference = {
  volume: number;
  muted: boolean;
  lastVolume: number;
};

export const DEFAULT_VOLUME_PREFERENCE: VolumePreference = {
  volume: DEFAULT_VOLUME,
  muted: false,
  lastVolume: DEFAULT_VOLUME,
};

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Perceptual volume curve: the slider value is linear to the ear, while the
 * actual gain follows value². Used for both Web Audio and HTMLMediaElement.
 */
export function volumeToGain(volume: number): number {
  return (clampVolume(volume) / 100) ** 2;
}

export function resolveVolumeIcon(
  volume: number,
  muted: boolean,
): VolumeIconState {
  const value = clampVolume(volume);
  if (muted || value === 0) return "mute";
  if (value <= 33) return "low";
  if (value <= 66) return "medium";
  return "high";
}

function defaultPreference(): VolumePreference {
  return { ...DEFAULT_VOLUME_PREFERENCE };
}

export function loadVolumePreference(
  storage: Storage | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): VolumePreference {
  if (!storage) return defaultPreference();
  try {
    const raw = storage.getItem(VOLUME_STORAGE_KEY);
    if (!raw) return defaultPreference();
    const parsed = JSON.parse(raw) as Partial<VolumePreference> | null;
    if (!parsed || typeof parsed !== "object") return defaultPreference();

    const volume = clampVolume(
      typeof parsed.volume === "number" ? parsed.volume : DEFAULT_VOLUME,
    );
    const lastVolume = clampVolume(
      typeof parsed.lastVolume === "number" ? parsed.lastVolume : volume,
    );
    return {
      volume,
      muted: parsed.muted === true,
      lastVolume: lastVolume > 0 ? lastVolume : DEFAULT_VOLUME,
    };
  } catch {
    return defaultPreference();
  }
}

export function saveVolumePreference(
  preference: VolumePreference,
  storage: Storage | undefined = typeof localStorage === "undefined"
    ? undefined
    : localStorage,
): void {
  if (!storage) return;
  try {
    storage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Persistence is best-effort (private mode, blocked storage, quota).
  }
}
