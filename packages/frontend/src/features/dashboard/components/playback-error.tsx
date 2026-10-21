import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function PlaybackErrorNotice({
  error,
  className,
}: {
  error?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();

  if (!error) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "border-warning/30 bg-warning/10 text-warning flex items-start gap-2 border px-4 py-2",
        className,
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 text-xs leading-5 break-words">
        {t("player.mpdError", { error })}
      </p>
    </div>
  );
}
