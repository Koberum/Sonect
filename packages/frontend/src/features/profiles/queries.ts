import { queryOptions, mutationOptions } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { qk } from "@/lib/queryKeys";
import {
  createProfile,
  deleteProfile,
  listProfiles,
  updateProfile,
} from "./api";

export const profileQueries = {
  list: () =>
    queryOptions({
      queryKey: qk.profiles.list(),
      queryFn: ({ signal }) => listProfiles(signal),
      staleTime: 30_000,
    }),
};

export const profileMutations = {
  create: () =>
    mutationOptions({
      mutationFn: ({
        name,
        avatarColor,
      }: {
        name: string;
        avatarColor?: string;
      }) => createProfile(name, avatarColor),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: qk.profiles.list() });
      },
    }),
  update: () =>
    mutationOptions({
      mutationFn: ({
        id,
        ...data
      }: {
        id: string;
        name?: string;
        avatarColor?: string;
      }) => updateProfile(id, data),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: qk.profiles.list() });
      },
    }),
  remove: () =>
    mutationOptions({
      mutationFn: (id: string) => deleteProfile(id),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: qk.profiles.list() });
      },
    }),
};
