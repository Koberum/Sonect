import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import type { SyncProgress } from "@/components/playback-context";
import {
  getSyncItemLabel,
  getSyncPercent,
  getSyncPhaseMeta,
  SYNC_TOTAL_STEPS,
} from "@/features/sync/sync-phase";
import { cn } from "@/lib/utils";

type SyncProgressViewProps = {
  progress: SyncProgress;
  className?: string;
};

export function SyncProgressView({
  progress,
  className,
}: SyncProgressViewProps) {
  const { t } = useTranslation();
  const meta = getSyncPhaseMeta(progress);
  const percent = getSyncPercent(progress);
  const item = getSyncItemLabel(progress);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
          <span className="truncate text-sm font-medium">
            {t(meta.labelKey)}
          </span>
        </div>
        {percent !== null && (
          <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
            {percent}%
          </span>
        )}
      </div>

      <Progress
        value={percent ?? 0}
        indeterminate={!meta.determinate || percent === null}
        aria-label={t(meta.labelKey)}
      />

      {item && <p className="text-muted-foreground truncate text-xs">{item}</p>}

      <div className="text-muted-foreground flex min-w-0 items-center justify-between gap-2 text-xs">
        <span className="truncate">
          {t("sync.stepOf", {
            current: meta.step,
            total: SYNC_TOTAL_STEPS,
          })}
        </span>
        {progress.total > 0 && (
          <span className="shrink-0 tabular-nums">
            {progress.current} / {progress.total}
          </span>
        )}
      </div>
    </div>
  );
}
