import { useQuery } from "@tanstack/react-query";
import type { NetworkStatus } from "@repo/types";
import { usePlaybackContext } from "@/components/playback-context";
import { systemQueries } from "@/features/system/queries";

export function useNetworkStatus(): NetworkStatus | null {
  const { syncProgress } = usePlaybackContext();
  const isSyncing = syncProgress !== null;
  const { data } = useQuery({
    ...systemQueries.health(),
    refetchInterval: isSyncing ? 60_000 : 30_000,
    select: (d) => d.network,
  });
  return (data as unknown as NetworkStatus | undefined) ?? null;
}
