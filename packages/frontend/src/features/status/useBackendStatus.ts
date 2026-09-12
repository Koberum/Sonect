import { useQuery } from "@tanstack/react-query";
import { usePlaybackContext } from "@/components/playback-context";
import { useRef, useEffect, useState } from "react";

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
  const [isOnline, setIsOnline] = useState(true);

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

  useEffect(() => {
    if (isSuccess) {
      failureCountRef.current = 0;
      if (!isOnline && wasEverOfflineRef.current) {
        setIsOnline(true);
      }
    } else if (isError) {
      failureCountRef.current++;
      if (failureCountRef.current >= FAILURE_THRESHOLD) {
        wasEverOfflineRef.current = true;
        setIsOnline(false);
      }
    }
  }, [isSuccess, isError, isOnline]);

  return { isOnline, isChecking: isFetching };
}
