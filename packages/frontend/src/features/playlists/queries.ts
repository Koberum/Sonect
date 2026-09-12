import { queryOptions, mutationOptions } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { queryClient } from "@/lib/queryClient";
import {
  getPlaylists,
  getPlaylist,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  loadPlaylist,
} from "./api";

export const playlistQueries = {
  list: () =>
    queryOptions({
      queryKey: qk.playlists.list(),
      queryFn: ({ signal }) => getPlaylists(signal),
      staleTime: 30_000,
    }),

  detail: (id: number) =>
    queryOptions({
      queryKey: qk.playlists.detail(id),
      queryFn: ({ signal }) => getPlaylist(id, signal),
      enabled: !!id,
      staleTime: 30_000,
    }),
};

export const playlistMutations = {
  create: () =>
    mutationOptions({
      mutationFn: (vars: { name: string; description?: string }) =>
        createPlaylist(vars.name, vars.description),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.playlists.list() });
      },
    }),

  update: () =>
    mutationOptions({
      mutationFn: (vars: {
        id: number;
        data: { name?: string; description?: string };
      }) => updatePlaylist(vars.id, vars.data),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({ queryKey: qk.playlists.list() });
        queryClient.invalidateQueries({
          queryKey: qk.playlists.detail(vars.id),
        });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (id: number) => deletePlaylist(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk.playlists.list() });
      },
    }),

  addTrack: () =>
    mutationOptions({
      mutationFn: (vars: { playlistId: number; trackId: number }) =>
        addTrackToPlaylist(vars.playlistId, vars.trackId),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: qk.playlists.detail(vars.playlistId),
        });
        queryClient.invalidateQueries({ queryKey: qk.playlists.list() });
      },
    }),

  removeTrack: () =>
    mutationOptions({
      mutationFn: (vars: { playlistId: number; ptId: number }) =>
        removeTrackFromPlaylist(vars.playlistId, vars.ptId),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: qk.playlists.detail(vars.playlistId),
        });
      },
    }),

  load: () =>
    mutationOptions({
      mutationFn: (id: number) => loadPlaylist(id),
    }),
};
