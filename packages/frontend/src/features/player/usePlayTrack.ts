import { useCallback } from "react";
import {
  playSong,
  addToQueue as unifiedAddToQueue,
} from "@/features/player/api";
import { usePlaybackContext } from "@/components/playback-context";
import type { Track } from "@repo/types/catalog";

export function usePlayTrack() {
  const { applyPlaybackStatus } = usePlaybackContext();

  const play = useCallback(
    async (track: Track) => {
      if (!track.file) return;
      applyPlaybackStatus(await playSong(track));
    },
    [applyPlaybackStatus],
  );

  const addToQueue = useCallback(async (file: string) => {
    if (!file) return;
    await unifiedAddToQueue(file);
  }, []);

  return { play, addToQueue };
}
