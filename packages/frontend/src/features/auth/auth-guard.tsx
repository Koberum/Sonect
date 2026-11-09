import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { useAuth } from "./auth-context";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, bootstrapRequired } = useAuth();
  const location = useLocation();

  if (isLoading) return <PageSkeleton />;

  if (bootstrapRequired) {
    return location.pathname === "/setup" ? (
      <>{children}</>
    ) : (
      <Navigate to="/setup" replace />
    );
  }

  if (!isAuthenticated) {
    return location.pathname === "/login" ? (
      <>{children}</>
    ) : (
      <Navigate to="/login" replace />
    );
  }

  if (location.pathname === "/login") return <Navigate to="/" replace />;
  return <>{children}</>;
}
