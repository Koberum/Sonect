import { queryOptions, mutationOptions } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import {
  getActiveMounts,
  getAudioDevices,
  getAudioStatus,
  getHardwareUsage,
  getMpdStatus,
  getNetworkStatus,
  getOutputMode,
  getStorageSources,
  createStorageSource,
  updateStorageSource,
  deleteStorageSource,
  mountStorageSource,
  unmountStorageSource,
  configureAudio,
  getDashboard,
} from "./api";

export const systemQueries = {
  audioDevices: () =>
    queryOptions({
      queryKey: qk.system.audioDevices(),
      queryFn: ({ signal }) => getAudioDevices(signal),
      staleTime: 5 * 60_000,
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

  activeMounts: () =>
    queryOptions({
      queryKey: qk.system.activeMounts(),
      queryFn: ({ signal }) => getActiveMounts(signal),
      staleTime: 60_000,
    }),

  networkStatus: () =>
    queryOptions({
      queryKey: qk.system.networkStatus(),
      queryFn: ({ signal }) => getNetworkStatus(signal),
      staleTime: 0,
      refetchInterval: 15_000,
    }),

  hardwareUsage: (enabled = true) =>
    queryOptions({
      queryKey: qk.system.hardwareUsage(),
      queryFn: ({ signal }) => getHardwareUsage(signal),
      enabled,
      staleTime: 0,
      refetchInterval: enabled ? 2000 : false,
    }),

  outputMode: () =>
    queryOptions({
      queryKey: qk.system.outputMode(),
      queryFn: ({ signal }) => getOutputMode(signal),
      staleTime: 60_000,
    }),

  mpdStatus: () =>
    queryOptions({
      queryKey: qk.system.mpdStatus(),
      queryFn: ({ signal }) => getMpdStatus(signal),
      staleTime: 30_000,
    }),

  dashboard: () =>
    queryOptions({
      queryKey: qk.dashboard(),
      queryFn: ({ signal }) => getDashboard(signal),
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
        queryClient.invalidateQueries({ queryKey: qk.system.activeMounts() });
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
        queryClient.invalidateQueries({ queryKey: qk.system.activeMounts() });
      },
    }),

  deleteStorageSource: () =>
    mutationOptions({
      mutationFn: (id: number) => deleteStorageSource(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.system.storageSources() });
        queryClient.invalidateQueries({ queryKey: qk.system.activeMounts() });
      },
    }),

  mount: () =>
    mutationOptions({
      mutationFn: (id: number) => mountStorageSource(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.system.activeMounts() });
        queryClient.invalidateQueries({ queryKey: qk.system.storageSources() });
      },
    }),

  unmount: () =>
    mutationOptions({
      mutationFn: (id: number) => unmountStorageSource(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.system.activeMounts() });
        queryClient.invalidateQueries({ queryKey: qk.system.storageSources() });
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
