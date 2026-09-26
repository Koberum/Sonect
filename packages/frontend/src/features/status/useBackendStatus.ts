import { useQuery } from "@tanstack/react-query";
import { usePlaybackContext } from "@/components/playback-context";
import { useRef, useEffect, useState } from "react";
import { systemQueries } from "@/features/system/queries";

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
    ...systemQueries.health(),
    refetchInterval: isSyncing ? 60_000 : 30_000,
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
