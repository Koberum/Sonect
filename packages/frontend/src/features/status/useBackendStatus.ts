import { useQuery } from "@tanstack/react-query";
import { usePlaybackContext } from "@/components/playback-context";
import { useRef, useEffect } from "react";

const FAILURE_THRESHOLD = 3;

export interface BackendStatus {
  isOnline: boolean;
  isChecking: boolean;
}

export function useBackendStatus(): BackendStatus {
  const { syncProgress } = usePlaybackContext();
  const isSyncing = syncProgress !== null;
  const failureCountRef = useRef(0);
  const wasEverOfflineRef = useRef(false);

  const { isFetching, isError, isSuccess } = useQuery({
    queryKey: ["system", "backend", "status", isSyncing ? "syncing" : "idle"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/system/status", {
        method: "GET",
        signal: signal ?? AbortSignal.timeout(5_000),
      });
      if (!res.ok) throw new Error("offline");
      return true;
    },
    refetchInterval: isSyncing ? 60_000 : 15_000,
    refetchIntervalInBackground: false,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Track offline threshold via effect
  const isOnlineRef = useRef(true);
  useEffect(() => {
    if (isSuccess) {
      failureCountRef.current = 0;
      if (!isOnlineRef.current && wasEverOfflineRef.current) {
        isOnlineRef.current = true;
      }
    } else if (isError) {
      failureCountRef.current++;
      if (failureCountRef.current >= FAILURE_THRESHOLD) {
        wasEverOfflineRef.current = true;
        isOnlineRef.current = false;
      }
    }
  }, [isSuccess, isError]);

  // Derive isOnline synchronously for render (ref value is updated via effect next tick,
  // but we also check current error state threshold)
  const isOnline =
    isError && failureCountRef.current >= FAILURE_THRESHOLD - 1
      ? false
      : isOnlineRef.current;

  return { isOnline, isChecking: isFetching };
}
