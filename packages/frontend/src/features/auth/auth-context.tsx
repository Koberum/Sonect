import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthProfile } from "@repo/types";
import { qk } from "@/lib/queryKeys";
import { authMutations, authQueries } from "./queries";

type AuthContextValue = {
  isLoading: boolean;
  isAuthenticated: boolean;
  profile: AuthProfile | null;
  isAdmin: boolean;
  bootstrapRequired: boolean;
  bootstrap: (input: { name: string; password: string }) => Promise<void>;
  login: (input: { profileId: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  switchProfile: (input: {
    profileId: string;
    password: string;
  }) => Promise<void>;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: state, isLoading } = useQuery(authQueries.state());
  const bootstrapMut = useMutation(authMutations.bootstrap());
  const loginMut = useMutation(authMutations.login());
  const logoutMut = useMutation(authMutations.logout());
  const switchMut = useMutation(authMutations.switchProfile());
  const changeMut = useMutation(authMutations.changePassword());

  useEffect(() => {
    const onUnauthorized = () => {
      void queryClient.invalidateQueries({ queryKey: qk.auth.state() });
    };
    window.addEventListener("sonect:unauthorized", onUnauthorized);
    return () =>
      window.removeEventListener("sonect:unauthorized", onUnauthorized);
  }, [queryClient]);

  const bootstrap = useCallback(
    async (input: { name: string; password: string }) => {
      sessionStorage.removeItem("setup-complete");
      await bootstrapMut.mutateAsync(input);
    },
    [bootstrapMut],
  );
  const login = useCallback(
    async (input: { profileId: string; password: string }) => {
      sessionStorage.removeItem("setup-complete");
      await loginMut.mutateAsync(input);
    },
    [loginMut],
  );
  const logout = useCallback(async () => {
    sessionStorage.removeItem("setup-complete");
    await logoutMut.mutateAsync();
  }, [logoutMut]);
  const switchProfile = useCallback(
    async (input: { profileId: string; password: string }) => {
      sessionStorage.removeItem("setup-complete");
      await switchMut.mutateAsync(input);
    },
    [switchMut],
  );
  const changePassword = useCallback(
    async (input: { currentPassword: string; newPassword: string }) => {
      await changeMut.mutateAsync(input);
    },
    [changeMut],
  );

  const profile = state?.profile ?? null;

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: state?.authenticated ?? false,
      profile,
      isAdmin: profile?.role === "admin",
      bootstrapRequired: state?.bootstrapRequired ?? false,
      bootstrap,
      login,
      logout,
      switchProfile,
      changePassword,
    }),
    [
      isLoading,
      state?.authenticated,
      state?.bootstrapRequired,
      profile,
      bootstrap,
      login,
      logout,
      switchProfile,
      changePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
