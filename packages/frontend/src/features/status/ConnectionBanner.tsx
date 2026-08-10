import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useBackendStatus } from "./useBackendStatus";
import { WifiOff } from "lucide-react";

export function ConnectionBanner() {
  const { isOnline } = useBackendStatus();
  const { t } = useTranslation();
  const prevOnlineRef = useRef(isOnline);
  const toastIdRef = useRef<string | number | null>(null);

  useEffect(() => {
    if (prevOnlineRef.current === isOnline) return;
    prevOnlineRef.current = isOnline;

    if (isOnline) {
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
      toast.success(t("status.backendOnline"), { duration: 3000 });
    }

    return () => {
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, [isOnline, t]);

  if (isOnline) return null;

  return (
    <div className="bg-destructive text-destructive-foreground flex items-center gap-2 px-4 py-2 text-sm">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>{t("status.backendUnreachable")}</span>
    </div>
  );
}
