import { queryOptions, mutationOptions } from "@tanstack/react-query";
import type { ProfileRole } from "@repo/types";
import { queryClient } from "@/lib/queryClient";
import { qk } from "@/lib/queryKeys";
import { clearProfileScopedQueries } from "@/features/auth/queries";
import {
  createProfile,
  deleteProfile,
  listProfiles,
  resetProfilePassword,
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

function invalidateProfiles(): void {
  void queryClient.invalidateQueries({ queryKey: qk.profiles.list() });
  void queryClient.invalidateQueries({ queryKey: qk.auth.profiles() });
  void queryClient.invalidateQueries({ queryKey: qk.auth.state() });
  clearProfileScopedQueries();
}

export const profileMutations = {
  create: () =>
    mutationOptions({
      mutationFn: createProfile,
      onSuccess: invalidateProfiles,
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
        role?: ProfileRole;
      }) => updateProfile(id, data),
      onSuccess: invalidateProfiles,
    }),
  resetPassword: () =>
    mutationOptions({
      mutationFn: ({ id, password }: { id: string; password: string }) =>
        resetProfilePassword(id, password),
      onSuccess: invalidateProfiles,
    }),
  remove: () =>
    mutationOptions({
      mutationFn: (id: string) => deleteProfile(id),
      onSuccess: invalidateProfiles,
    }),
};
