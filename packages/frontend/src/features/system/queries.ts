import { queryOptions, mutationOptions } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import {
  getDetectedLibraries,
  getAudioDevices,
  getAudioStatus,
  getHardwareUsage,
  getHealth,
  getOutputMode,
  getStorageSources,
  createStorageSource,
  updateStorageSource,
  deleteStorageSource,
  refreshStorageStats,
  getStorageStats,
  configureAudio,
  getDashboard,
} from "./api";

export const systemQueries = {
  audioDevices: () =>
    queryOptions({
      queryKey: qk.system.audioDevices(),
      queryFn: ({ signal }) => getAudioDevices(signal),
      // Devices can appear/disappear at runtime (USB DAC hotplug), so keep
      // this list fresh while the audio settings tab is open.
      staleTime: 0,
      refetchInterval: 15_000,
      refetchOnWindowFocus: true,
    }),

  audioStatus: () =>
    queryOptions({
      queryKey: qk.system.audioStatus(),
      queryFn: ({ signal }) => getAudioStatus(signal),
      staleTime: 5 * 60_000,
    }),

  storageSources: () =>
    queryOptions({
      queryKey: qk.system.storageSources(),
      queryFn: ({ signal }) => getStorageSources(signal),
      staleTime: 60_000,
    }),

  detectedLibraries: () =>
    queryOptions({
      queryKey: qk.system.detectedLibraries(),
      queryFn: ({ signal }) => getDetectedLibraries(signal),
      staleTime: 30_000,
    }),

  health: () =>
    queryOptions({
      queryKey: qk.system.health(),
      queryFn: ({ signal }) => getHealth(signal),
      staleTime: 0,
      gcTime: 0,
      retry: false,
      refetchInterval: 30_000,
      refetchIntervalInBackground: false,
    }),

  hardwareUsage: (enabled = true) =>
    queryOptions({
      queryKey: qk.system.hardwareUsage(),
      queryFn: ({ signal }) => getHardwareUsage(signal),
      enabled,
      staleTime: 0,
      refetchInterval: enabled ? 5000 : false,
      refetchIntervalInBackground: false,
    }),

  outputMode: () =>
    queryOptions({
      queryKey: qk.system.outputMode(),
      queryFn: ({ signal }) => getOutputMode(signal),
      staleTime: 60_000,
    }),

  dashboard: (profileId: string) =>
    queryOptions({
      queryKey: qk.dashboard(profileId),
      queryFn: ({ signal }) => getDashboard(signal),
      enabled: Boolean(profileId),
      staleTime: 30_000,
    }),
};

export const systemMutations = {
  createStorageSource: () =>
    mutationOptions({
      mutationFn: (data: Parameters<typeof createStorageSource>[0]) =>
        createStorageSource(data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.system.storageSources() });
        queryClient.invalidateQueries({
          queryKey: qk.system.detectedLibraries(),
        });
      },
    }),

  updateStorageSource: () =>
    mutationOptions({
      mutationFn: (vars: {
        id: number;
        data: Parameters<typeof updateStorageSource>[1];
      }) => updateStorageSource(vars.id, vars.data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.system.storageSources() });
        queryClient.invalidateQueries({
          queryKey: qk.system.detectedLibraries(),
        });
      },
    }),

  deleteStorageSource: () =>
    mutationOptions({
      mutationFn: (id: number) => deleteStorageSource(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.system.storageSources() });
        queryClient.invalidateQueries({
          queryKey: qk.system.detectedLibraries(),
        });
      },
    }),

  refreshStorageStats: () =>
    mutationOptions({
      mutationFn: (id: number) => refreshStorageStats(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.system.storageSources() });
      },
    }),

  computeStorageStats: () =>
    mutationOptions({
      mutationFn: (path: string) => getStorageStats(path),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: qk.system.detectedLibraries(),
        });
      },
    }),

  configureAudio: () =>
    mutationOptions({
      mutationFn: (params: Parameters<typeof configureAudio>[0]) =>
        configureAudio(params),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.system.audioDevices() });
        queryClient.invalidateQueries({ queryKey: qk.system.audioStatus() });
      },
    }),
};
