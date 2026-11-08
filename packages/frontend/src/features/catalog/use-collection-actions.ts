import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Track } from "@repo/types/catalog";
import { usePlayTrack } from "@/features/player/usePlayTrack";

/**
 * Play/enqueue actions for cards that need the collection's tracks first
 * (album and artist cards). The loader is responsible for any caching.
 */
export function useCollectionActions(loadTracks: () => Promise<Track[]>) {
  const { play, addToQueue } = usePlayTrack();
  const { t } = useTranslation();

  const playFirst = useCallback(async () => {
    try {
      const tracks = await loadTracks();
      if (tracks[0]) await play(tracks[0]);
    } catch {
      toast.error(t("common.loadError"));
    }
  }, [loadTracks, play, t]);

  const enqueueAll = useCallback(async () => {
    let tracks: Track[];
    try {
      tracks = await loadTracks();
    } catch {
      toast.error(t("common.loadError"));
      return;
    }
    // Enqueue sequentially so the server preserves collection order.
    for (const track of tracks) {
      await addToQueue(track.file);
    }
  }, [loadTracks, addToQueue, t]);

  return { playFirst, enqueueAll };
}
