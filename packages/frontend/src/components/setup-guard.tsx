import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSetupProgress } from "@/features/apis/systemApis";

export function SetupGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        if (sessionStorage.getItem("setup-skipped")) {
          setChecking(false);
          return;
        }
        const progress = await getSetupProgress();
        if (!cancelled) {
          if (!progress.complete) {
            navigate("/setup", { replace: true });
          } else {
            setChecking(false);
          }
        }
      } catch {
        if (!cancelled) setChecking(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    );
  }

  return <>{children}</>;
}
