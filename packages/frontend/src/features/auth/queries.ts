import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { AuthProfile } from "@repo/types";
import { queryClient } from "@/lib/queryClient";
import { qk } from "@/lib/queryKeys";
import {
  bootstrapAdmin,
  changePassword,
  getAuthState,
  listPublicProfiles,
  login,
  logout,
  switchProfile,
} from "./api";

export const authQueries = {
  state: () =>
    queryOptions({
      queryKey: qk.auth.state(),
      queryFn: ({ signal }) => getAuthState(signal),
      staleTime: 0,
      retry: false,
    }),
  profiles: () =>
    queryOptions({
      queryKey: qk.auth.profiles(),
      queryFn: ({ signal }) => listPublicProfiles(signal),
      staleTime: 30_000,
    }),
};

export function clearProfileScopedQueries(): void {
  queryClient.removeQueries({ queryKey: qk.dashboardRoot() });
  queryClient.removeQueries({ queryKey: qk.player.queue() });
  queryClient.removeQueries({ queryKey: qk.system.outputMode() });
}

function setAuthenticated(profile: AuthProfile): void {
  queryClient.setQueryData(qk.auth.state(), {
    bootstrapRequired: false,
    authenticated: true,
    profile,
  });
  clearProfileScopedQueries();
  void queryClient.invalidateQueries({ queryKey: qk.auth.profiles() });
}

export const authMutations = {
  bootstrap: () =>
    mutationOptions({
      mutationFn: bootstrapAdmin,
      onSuccess: (data) => setAuthenticated(data.profile),
    }),
  login: () =>
    mutationOptions({
      mutationFn: login,
      onSuccess: (data) => setAuthenticated(data.profile),
    }),
  logout: () =>
    mutationOptions({
      mutationFn: logout,
      onSuccess: () => {
        queryClient.setQueryData(qk.auth.state(), {
          bootstrapRequired: false,
          authenticated: false,
          profile: null,
        });
        clearProfileScopedQueries();
        void queryClient.invalidateQueries({ queryKey: qk.auth.profiles() });
      },
    }),
  switchProfile: () =>
    mutationOptions({
      mutationFn: switchProfile,
      onSuccess: (data) => setAuthenticated(data.profile),
    }),
  changePassword: () => mutationOptions({ mutationFn: changePassword }),
};
