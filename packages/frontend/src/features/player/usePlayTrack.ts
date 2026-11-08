import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  playSong,
  addToQueue as unifiedAddToQueue,
} from "@/features/player/api";
import { usePlaybackContext } from "@/components/playback-context";
import type { Track } from "@repo/types/catalog";

const QUEUE_ERROR_TOAST_ID = "sonect-queue-error";

export function usePlayTrack() {
  const { applyPlaybackStatus } = usePlaybackContext();
  const { t } = useTranslation();

  const play = useCallback(
    async (track: Track) => {
      if (!track.file) return;
      try {
        applyPlaybackStatus(await playSong(track));
      } catch {
        toast.error(t("player.playbackError"));
      }
    },
    [applyPlaybackStatus, t],
  );

  const addToQueue = useCallback(
    async (file: string) => {
      if (!file) return;
      try {
        await unifiedAddToQueue(file);
      } catch {
        toast.error(t("player.queueError"), { id: QUEUE_ERROR_TOAST_ID });
      }
    },
    [t],
  );

  return { play, addToQueue };
}
