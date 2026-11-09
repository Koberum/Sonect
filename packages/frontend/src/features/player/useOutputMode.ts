import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/auth-context";
import { usePlaybackContext } from "@/components/playback-context";
import { playerQueries } from "./queries";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { qk } from "@/lib/queryKeys";
import type { OutputMode } from "@repo/types";
import { setOutputMode as apiSetOutputMode } from "./api";

/**
 * Shared output-mode state for the compact and full player views. The backend
 * is authoritative for the mode and the active device.
 */
export function useOutputMode() {
  const { outputMode, setOutputMode } = usePlaybackContext();
  const { profile } = useAuth();
  const profileId = profile?.id ?? "";
  const { t } = useTranslation();
  const { data } = useQuery({
    ...playerQueries.outputMode(profileId),
    // Another profile may release the MPD lock while this view stays open.
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const mpdOwner = data?.mpdOwner ?? null;
  const isMpdLockedForMe =
    !!mpdOwner && mpdOwner !== (profile?.id ?? "") && outputMode !== "mpd";

  const changeOutputMode = async (mode: OutputMode) => {
    const previous = outputMode;
    setOutputMode(mode);
    try {
      await apiSetOutputMode(mode);
      queryClient.invalidateQueries({ queryKey: qk.player.queueRoot() });
      queryClient.invalidateQueries({ queryKey: qk.player.outputModeRoot() });
    } catch (error) {
      setOutputMode(previous);
      if (error instanceof ApiError && error.status === 423) {
        queryClient.invalidateQueries({
          queryKey: qk.player.outputModeRoot(),
        });
        toast.error(t("player.outputInUseByOther"));
      } else {
        toast.error(t("player.outputModeError"));
      }
    }
  };

  return {
    outputMode,
    deviceName: data?.deviceName ?? null,
    mpdOwner,
    isMpdLockedForMe,
    changeOutputMode,
  };
}
