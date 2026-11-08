import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_VOLUME,
  DEFAULT_VOLUME_PREFERENCE,
  clampVolume,
  hasVolumePreference,
  loadVolumePreference,
  saveVolumePreference,
  type VolumePreference,
} from "@/lib/volume";

export type UseVolumePreferenceReturn = VolumePreference & {
  /** Volume sent to the engine: 0 while muted. */
  effectiveVolume: number;
  /** Whether a preference was already present in localStorage. */
  hasStoredPreference: boolean;
  setVolume: (volume: number) => void;
  /** Applies a volume received from the server without changing mute state. */
  applyServerVolume: (volume: number) => void;
  toggleMute: () => void;
  resetVolume: () => void;
};

/**
 * Browser-local volume preference. The volume is persisted in localStorage and
 * kept in sync with the player engine; mute is intentionally local-only so it
 * never zeroes the shared per-profile volume for other devices.
 */
export function useVolumePreference(): UseVolumePreferenceReturn {
  const [preference, setPreference] = useState<VolumePreference>(() =>
    loadVolumePreference(),
  );
  const [hasStoredPreference] = useState(() => hasVolumePreference());
  const preferenceRef = useRef(preference);

  useEffect(() => {
    preferenceRef.current = preference;
  }, [preference]);

  const commit = useCallback((next: VolumePreference) => {
    preferenceRef.current = next;
    saveVolumePreference(next);
    setPreference(next);
  }, []);

  const setVolume = useCallback(
    (value: number) => {
      const previous = preferenceRef.current;
      const volume = clampVolume(value);
      commit({
        volume,
        muted: false,
        lastVolume: volume > 0 ? volume : previous.lastVolume,
      });
    },
    [commit],
  );

  const applyServerVolume = useCallback(
    (value: number) => {
      const previous = preferenceRef.current;
      const volume = clampVolume(value);
      if (volume === previous.volume && volume === previous.lastVolume) return;
      commit({
        volume,
        muted: previous.muted,
        lastVolume: volume > 0 ? volume : previous.lastVolume,
      });
    },
    [commit],
  );

  const toggleMute = useCallback(() => {
    const previous = preferenceRef.current;
    if (previous.muted || previous.volume === 0) {
      const restore =
        previous.lastVolume > 0 ? previous.lastVolume : DEFAULT_VOLUME;
      commit({ volume: restore, muted: false, lastVolume: restore });
      return;
    }
    commit({ ...previous, muted: true, lastVolume: previous.volume });
  }, [commit]);

  const resetVolume = useCallback(() => {
    commit({ ...DEFAULT_VOLUME_PREFERENCE });
  }, [commit]);

  return {
    ...preference,
    effectiveVolume: preference.muted ? 0 : preference.volume,
    hasStoredPreference,
    setVolume,
    applyServerVolume,
    toggleMute,
    resetVolume,
  };
}
