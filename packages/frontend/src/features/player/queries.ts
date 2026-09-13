import { queryOptions } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { getQueue } from "./api";

export const playerQueries = {
  queue: (enabled = true) =>
    queryOptions({
      queryKey: qk.player.queue(),
      queryFn: ({ signal }) => getQueue(signal),
      enabled,
      staleTime: 0,
      refetchInterval: enabled ? 5000 : false,
    }),
};

// Backcompat alias — remove once all callers migrated
export const mpdQueries = playerQueries;
