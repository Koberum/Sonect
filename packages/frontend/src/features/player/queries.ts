import { queryOptions } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { getQueue, getWaveform } from "./api";

export const playerQueries = {
  queue: (enabled = true) =>
    queryOptions({
      queryKey: qk.player.queue(),
      queryFn: ({ signal }) => getQueue(signal),
      enabled,
      staleTime: 0,
      refetchInterval: enabled ? 10_000 : false,
      refetchIntervalInBackground: false,
    }),
  waveform: (trackId: number | null | undefined) =>
    queryOptions({
      queryKey: qk.player.waveform(trackId ?? -1),
      queryFn: ({ signal }) => getWaveform(trackId as number, signal),
      enabled: typeof trackId === "number" && trackId > 0,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
    }),
};

// Backcompat alias — remove once all callers migrated
export const mpdQueries = playerQueries;
