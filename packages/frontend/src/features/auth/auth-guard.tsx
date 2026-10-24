import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context";

function Loader() {
  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
    </div>
  );
}

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, bootstrapRequired } = useAuth();
  const location = useLocation();

  if (isLoading) return <Loader />;

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
