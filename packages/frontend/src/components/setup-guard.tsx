import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { isSetupCompleteForSession } from "@/features/system/api";
import { useAuth } from "@/features/auth/auth-context";

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  const { isAdmin, profile } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

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
            navigateRef.current("/setup", { replace: true });
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
  }, [isAdmin, profile?.id]);

  if (!isAdmin) return <>{children}</>;

  if (checking) {
    return <PageSkeleton />;
  }

  return <>{children}</>;
}
