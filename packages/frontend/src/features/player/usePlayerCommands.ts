import { useCallback } from "react";
import type { PlaybackStatus } from "@repo/types";
import type { Track } from "@repo/types/catalog";
import { usePlaybackContext } from "@/components/playback-context";
import {
  nextTrack,
  pauseSong,
  playSong,
  previousTrack,
  resumeSong,
  setRandom,
  setRepeat,
} from "./api";

/**
 * Shared command surface for the compact and full player views. Every command
 * applies the authoritative status returned by the backend.
 */
export function usePlayerCommands() {
  const { applyPlaybackStatus } = usePlaybackContext();

  const run = useCallback(
    (action: () => Promise<PlaybackStatus>) => {
      void action().then(applyPlaybackStatus);
    },
    [applyPlaybackStatus],
  );

  const play = useCallback(
    (track: Track | null | undefined) => {
      if (!track?.file) return;
      run(() => playSong(track));
    },
    [run],
  );

  const pause = useCallback(() => run(pauseSong), [run]);
  const resume = useCallback(() => run(resumeSong), [run]);
  const next = useCallback(() => run(nextTrack), [run]);
  const previous = useCallback(() => run(previousTrack), [run]);
  const toggleRandom = useCallback(
    (enabled: boolean) => run(() => setRandom(enabled)),
    [run],
  );
  const toggleRepeat = useCallback(
    (enabled: boolean) => run(() => setRepeat(enabled)),
    [run],
  );

  return {
    play,
    pause,
    resume,
    next,
    previous,
    toggleRandom,
    toggleRepeat,
  };
}
