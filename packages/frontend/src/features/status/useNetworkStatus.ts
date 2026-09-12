import { useQuery } from "@tanstack/react-query";
import type { NetworkStatus } from "@repo/types";
import { systemQueries } from "@/features/system/queries";

export function useNetworkStatus(): NetworkStatus | null {
  const { data } = useQuery({
    ...systemQueries.networkStatus(),
    // keep previous null on error, don't throw
  });
  return data ?? null;
}
