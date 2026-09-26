import { useCallback } from "react";
import {
  playSong,
  addToQueue as unifiedAddToQueue,
} from "@/features/player/api";
import type { Track } from "@repo/types/catalog";

export function usePlayTrack() {
  const play = useCallback((track: Track) => {
    if (!track.file) return Promise.resolve();
    return playSong(track);
  }, []);

  const addToQueue = useCallback((file: string) => {
    if (!file) return Promise.resolve();
    return unifiedAddToQueue(file);
  }, []);

  return { play, addToQueue };
}
