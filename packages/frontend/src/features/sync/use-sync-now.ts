import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlaybackContext } from "@/components/playback-context";
import { scanLibrary } from "@/features/catalog/api";

/**
 * Shared "start a library scan" action for the Settings sync card and the
 * sidebar status center. Running state includes the WebSocket progress so both
 * surfaces disable the button as soon as the backend accepts the scan.
 */
export function useSyncNow() {
  const { t } = useTranslation();
  const { syncProgress } = usePlaybackContext();
  const mutation = useMutation({
    mutationFn: () => scanLibrary(),
    onError: () => toast.error(t("sync.failed")),
  });

  return {
    syncNow: () => mutation.mutate(),
    running: mutation.isPending || syncProgress !== null,
    pending: mutation.isPending,
  };
}
