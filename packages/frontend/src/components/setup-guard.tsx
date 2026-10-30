import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isSetupCompleteForSession } from "@/features/system/api";
import { useAuth } from "@/features/auth/auth-context";

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { isAdmin, profile } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Setup is an admin concern; regular users can use the app immediately.
    if (!isAdmin) return;

    setChecking(true);
    let cancelled = false;
    const check = async () => {
      try {
        const complete = await isSetupCompleteForSession();
        if (!cancelled) {
          if (!complete) {
            navigate("/setup", { replace: true });
          } else {
            setChecking(false);
          }
        }
      } catch {
        if (!cancelled) setChecking(false);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, navigate, profile?.id]);

  if (!isAdmin) return <>{children}</>;

  if (checking) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  return <>{children}</>;
}
