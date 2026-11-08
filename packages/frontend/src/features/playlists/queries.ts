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
  list: (profileId: string) =>
    queryOptions({
      queryKey: qk.playlists.list(profileId),
      queryFn: ({ signal }) => getPlaylists(signal),
      enabled: !!profileId,
      staleTime: 30_000,
    }),

  detail: (profileId: string, id: number) =>
    queryOptions({
      queryKey: qk.playlists.detail(profileId, id),
      queryFn: ({ signal }) => getPlaylist(id, signal),
      enabled: !!profileId && !!id,
      staleTime: 30_000,
    }),
};

export const playlistMutations = {
  create: (profileId: string) =>
    mutationOptions({
      mutationFn: (vars: { name: string; description?: string }) =>
        createPlaylist(vars.name, vars.description),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: qk.playlists.list(profileId),
        });
      },
    }),

  update: (profileId: string) =>
    mutationOptions({
      mutationFn: (vars: {
        id: number;
        data: { name?: string; description?: string };
      }) => updatePlaylist(vars.id, vars.data),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: qk.playlists.list(profileId),
        });
        queryClient.invalidateQueries({
          queryKey: qk.playlists.detail(profileId, vars.id),
        });
      },
    }),

  delete: (profileId: string) =>
    mutationOptions({
      mutationFn: (id: number) => deletePlaylist(id),
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: qk.playlists.list(profileId),
        });
      },
    }),

  addTrack: (profileId: string) =>
    mutationOptions({
      mutationFn: (vars: { playlistId: number; trackId: number }) =>
        addTrackToPlaylist(vars.playlistId, vars.trackId),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: qk.playlists.detail(profileId, vars.playlistId),
        });
        queryClient.invalidateQueries({
          queryKey: qk.playlists.list(profileId),
        });
      },
    }),

  removeTrack: (profileId: string) =>
    mutationOptions({
      mutationFn: (vars: { playlistId: number; ptId: number }) =>
        removeTrackFromPlaylist(vars.playlistId, vars.ptId),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: qk.playlists.detail(profileId, vars.playlistId),
        });
        queryClient.invalidateQueries({
          queryKey: qk.playlists.list(profileId),
        });
      },
    }),

  load: () =>
    mutationOptions({
      mutationFn: (id: number) => loadPlaylist(id),
    }),
};
