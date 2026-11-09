import { mutationOptions, queryOptions } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import {
  getOutputMode,
  getPlaybackSettings,
  getQueue,
  getWaveform,
  setPlaybackSettings,
} from "./api";

export const playerQueries = {
  queue: (profileId: string, enabled = true) =>
    queryOptions({
      queryKey: qk.player.queue(profileId),
      queryFn: ({ signal }) => getQueue(signal),
      enabled: enabled && !!profileId,
      staleTime: 0,
      refetchInterval: enabled && !!profileId ? 10_000 : false,
      refetchIntervalInBackground: false,
    }),
  settings: (profileId: string) =>
    queryOptions({
      queryKey: qk.player.settings(profileId),
      queryFn: ({ signal }) => getPlaybackSettings(signal),
      enabled: !!profileId,
      staleTime: 60_000,
    }),
  outputMode: (profileId: string) =>
    queryOptions({
      queryKey: qk.player.outputMode(profileId),
      queryFn: ({ signal }) => getOutputMode(signal),
      enabled: !!profileId,
      staleTime: 60_000,
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

export const playerMutations = {
  setSettings: (profileId: string) =>
    mutationOptions({
      mutationFn: (crossfadeSeconds: number) =>
        setPlaybackSettings(crossfadeSeconds),
      onSuccess: (settings) => {
        queryClient.setQueryData(qk.player.settings(profileId), settings);
      },
    }),
};
