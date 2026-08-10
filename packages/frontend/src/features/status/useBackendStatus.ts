import { useEffect, useRef, useState } from "react";
import { usePlaybackContext } from "@/components/playback-context";

const HEARTBEAT_INTERVAL = 15_000;
const HEARTBEAT_INTERVAL_SYNCING = 60_000;
const FAILURE_THRESHOLD = 3;

export interface BackendStatus {
  isOnline: boolean;
  isChecking: boolean;
}

export function useBackendStatus(): BackendStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const failureCountRef = useRef(0);
  const wasEverOfflineRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { syncProgress } = usePlaybackContext();
  const isSyncing = syncProgress !== null;

  useEffect(() => {
    let cancelled = false;
    const interval = isSyncing
      ? HEARTBEAT_INTERVAL_SYNCING
      : HEARTBEAT_INTERVAL;

    const check = async () => {
      if (cancelled) return;
      setIsChecking(true);
      try {
        await fetch("/system/status", {
          method: "GET",
          signal: AbortSignal.timeout(5_000),
        });
        if (!cancelled) {
          failureCountRef.current = 0;
          if (!isOnline && wasEverOfflineRef.current) {
            setIsOnline(true);
          }
        }
      } catch {
        if (!cancelled) {
          failureCountRef.current++;
          if (failureCountRef.current >= FAILURE_THRESHOLD) {
            wasEverOfflineRef.current = true;
            setIsOnline(false);
          }
        }
      } finally {
        if (!cancelled) {
          setIsChecking(false);
        }
      }
    };

    check();
    timerRef.current = setInterval(check, interval);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSyncing]);

  return { isOnline, isChecking };
}
