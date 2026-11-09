import { AlertCircle, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { SyncProgressView } from "@/features/sync/components/sync-progress-view";
import { formatCount, formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StatusAction, StatusItem, StatusTone } from "../types";
import type { StatusCenterState } from "../use-status-center";

type StatusCenterContentProps = {
  status: StatusCenterState;
  className?: string;
  onNavigate?: () => void;
  /** Reserve room for the Sheet close button. */
  sheet?: boolean;
};

function toneSurface(tone: StatusTone): string {
  switch (tone) {
    case "error":
      return "border-destructive/30 bg-destructive/5";
    case "warning":
      return "border-warning/30 bg-warning/5";
    default:
      return "border-border bg-muted/30";
  }
}

function ToneIcon({
  tone,
  className,
}: {
  tone: StatusTone;
  className?: string;
}) {
  const classes = cn("size-4 shrink-0", className);
  if (tone === "error") {
    return <AlertTriangle className={cn(classes, "text-destructive")} />;
  }
  if (tone === "warning") {
    return <AlertCircle className={cn(classes, "text-warning")} />;
  }
  return <Loader2 className={cn(classes, "text-primary animate-spin")} />;
}

function StatusRow({
  item,
  onAction,
  syncRunning,
}: {
  item: StatusItem;
  onAction: (action: StatusAction) => void;
  syncRunning: boolean;
}) {
  const { t } = useTranslation();
  const description =
    item.description ??
    (item.descriptionKey ? t(item.descriptionKey) : undefined);
  const action = item.action;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3",
        toneSurface(item.tone),
      )}
    >
      <ToneIcon tone={item.tone} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t(item.titleKey)}</p>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-xs break-words">
            {description}
          </p>
        )}
        {item.progress !== undefined && item.progress !== null && (
          <Progress value={item.progress} className="mt-2" />
        )}
        {action && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => onAction(action)}
            disabled={action.kind === "sync" && syncRunning}
          >
            {t(action.labelKey)}
          </Button>
        )}
      </div>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg border p-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export function StatusCenterContent({
  status,
  className,
  onNavigate,
  sheet = false,
}: StatusCenterContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    items,
    stats,
    statsLoading,
    statsError,
    refetchStats,
    syncProgress,
    isAdmin,
    syncNow,
    syncRunning,
  } = status;

  const handleAction = (action: StatusAction) => {
    if (action.kind === "sync") {
      syncNow();
      return;
    }
    onNavigate?.();
    navigate(action.to, action.state ? { state: action.state } : undefined);
  };

  const relativeLastSync = stats?.lastSync
    ? formatRelativeTime(stats.lastSync)
    : null;

  return (
    <div className={cn("flex max-h-[min(32rem,80vh)] flex-col", className)}>
      <div
        className={cn(
          "flex shrink-0 items-start justify-between gap-3 border-b p-4",
          sheet ? "pr-12" : "pr-4",
        )}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("status.title")}</p>
          <p className="text-muted-foreground text-xs">
            {t("status.description")}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={syncNow}
            disabled={syncRunning}
          >
            {syncRunning ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {syncRunning ? t("sync.syncing") : t("sync.syncNow")}
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((item) =>
              item.id === "sync" && item.tone === "activity" && syncProgress ? (
                <div
                  key={item.id}
                  className="bg-muted/30 rounded-lg border p-3"
                >
                  <SyncProgressView progress={syncProgress} />
                </div>
              ) : (
                <StatusRow
                  key={item.id}
                  item={item}
                  onAction={handleAction}
                  syncRunning={syncRunning}
                />
              ),
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
            {t("status.library.title")}
          </h3>

          {statsLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : statsError || !stats ? (
            <div
              role="alert"
              className="border-destructive/50 bg-destructive/10 flex items-center justify-between gap-2 rounded-lg border p-3"
            >
              <span className="text-destructive text-sm">
                {t("status.library.statsUnavailable")}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refetchStats()}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <StatCell
                  label={t("statistics.totalTracks")}
                  value={formatCount(stats.totalTracks)}
                />
                <StatCell
                  label={t("statistics.totalAlbums")}
                  value={formatCount(stats.totalAlbums)}
                />
                <StatCell
                  label={t("statistics.totalArtists")}
                  value={formatCount(stats.totalArtists)}
                />
                <StatCell
                  label={t("statistics.totalDuration")}
                  value={formatDuration(stats.totalDuration)}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {relativeLastSync
                  ? t("status.library.lastSync", { time: relativeLastSync })
                  : t("status.library.neverSynced")}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t p-3">
        <Button
          variant="link"
          size="sm"
          onClick={() => {
            onNavigate?.();
            navigate("/library", { state: { tab: "statistics" } });
          }}
        >
          {t("status.actions.viewStatistics")}
        </Button>
        {isAdmin && (
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              onNavigate?.();
              navigate("/settings", { state: { tab: "libraries" } });
            }}
          >
            {t("status.actions.openSettings")}
          </Button>
        )}
      </div>
    </div>
  );
}
