import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface QueryErrorProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

/** Inline error row used when a query fails and a retry action makes sense. */
export function QueryError({ message, onRetry, className }: QueryErrorProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "border-destructive/40 bg-destructive/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4",
        className,
      )}
    >
      <p className="text-destructive text-sm">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
