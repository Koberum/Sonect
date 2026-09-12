import { queryOptions } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { getQueue } from "./api";

export const mpdQueries = {
  queue: (enabled = true) =>
    queryOptions({
      queryKey: qk.mpd.queue(),
      queryFn: ({ signal }) => getQueue(signal),
      enabled,
      staleTime: 0,
      refetchInterval: enabled ? 5000 : false,
    }),
};
