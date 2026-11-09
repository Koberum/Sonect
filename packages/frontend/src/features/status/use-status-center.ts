import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePlaybackContext } from "@/components/playback-context";
import { useAuth } from "@/features/auth/auth-context";
import { catalogQueries } from "@/features/catalog/queries";
import { useSyncNow } from "@/features/sync/use-sync-now";
import { systemQueries } from "@/features/system/queries";
import { buildStatusItems } from "./status-items";
import { useDelayedDisconnect } from "./use-delayed-disconnect";

export function useStatusCenter() {
  const { isAdmin } = useAuth();
  const { syncProgress, syncError, wsConnected } = usePlaybackContext();
  const disconnected = useDelayedDisconnect(wsConnected, 5000);

  const statsQuery = useQuery(catalogQueries.stats());

  const storageQuery = useQuery({
    ...systemQueries.storageSources(),
    enabled: isAdmin,
    refetchInterval: isAdmin ? 60_000 : false,
  });
  const audioStatusQuery = useQuery({
    ...systemQueries.audioStatus(),
    enabled: isAdmin,
    refetchInterval: isAdmin ? 60_000 : false,
  });
  const audioDevicesQuery = useQuery({
    ...systemQueries.audioDevices(),
    enabled: isAdmin,
    refetchInterval: isAdmin ? 60_000 : false,
  });
  const mpdStatusQuery = useQuery({
    ...systemQueries.mpdStatus(),
    enabled: isAdmin,
    refetchInterval: isAdmin ? 30_000 : false,
  });

  const { syncNow, running: syncRunning, pending: syncPending } = useSyncNow();

  const items = useMemo(
    () =>
      buildStatusItems({
        syncProgress,
        syncError,
        disconnected,
        isAdmin,
        storageSources: storageQuery.data,
        audioStatus: audioStatusQuery.data,
        audioDevices: audioDevicesQuery.data,
        mpdRunning: mpdStatusQuery.data?.running,
      }),
    [
      syncProgress,
      syncError,
      disconnected,
      isAdmin,
      storageQuery.data,
      audioStatusQuery.data,
      audioDevicesQuery.data,
      mpdStatusQuery.data?.running,
    ],
  );

  return {
    items,
    topItem: items[0] ?? null,
    stats: statsQuery.data,
    statsLoading: statsQuery.isPending,
    statsError: statsQuery.isError,
    refetchStats: statsQuery.refetch,
    syncProgress,
    isAdmin,
    syncNow,
    syncRunning,
    syncPending,
  };
}
