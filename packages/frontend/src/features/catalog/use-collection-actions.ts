import { useCallback } from "react";
import type { Track } from "@repo/types/catalog";
import { usePlayTrack } from "@/features/player/usePlayTrack";

/**
 * Play/enqueue actions for cards that need the collection's tracks first
 * (album and artist cards). The loader is responsible for any caching.
 */
export function useCollectionActions(loadTracks: () => Promise<Track[]>) {
  const { play, addToQueue } = usePlayTrack();

  const playFirst = useCallback(async () => {
    const tracks = await loadTracks();
    if (tracks[0]) await play(tracks[0]);
  }, [loadTracks, play]);

  const enqueueAll = useCallback(async () => {
    const tracks = await loadTracks();
    for (const track of tracks) void addToQueue(track.file);
  }, [loadTracks, addToQueue]);

  return { playFirst, enqueueAll };
}
