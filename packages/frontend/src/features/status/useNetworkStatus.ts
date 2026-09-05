import { useEffect, useState } from "react";
import type { NetworkStatus } from "@repo/types";
import { getNetworkStatus } from "@/features/apis/systemApis";

const NETWORK_STATUS_INTERVAL = 15_000;

export function useNetworkStatus(): NetworkStatus | null {
  const [status, setStatus] = useState<NetworkStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const nextStatus = await getNetworkStatus();
        if (!cancelled) {
          setStatus(nextStatus);
        }
      } catch {
        if (!cancelled) {
          setStatus(null);
        }
      }
    };

    void loadStatus();
    const interval = setInterval(
      () => void loadStatus(),
      NETWORK_STATUS_INTERVAL,
    );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return status;
}
