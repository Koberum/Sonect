import { useState } from "react";
import { AlertCircle, AlertTriangle, LibraryBig, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { StatusTone } from "../types";
import { useStatusCenter } from "../use-status-center";
import { StatusCenterContent } from "./status-center-content";

function StatusDot({ tone }: { tone: StatusTone }) {
  return (
    <span
      aria-hidden
      className={cn(
        "ring-card absolute top-0.5 right-0.5 size-2.5 rounded-full ring-2",
        tone === "error" && "bg-destructive",
        tone === "warning" && "bg-warning",
        tone === "activity" && "bg-primary",
      )}
    />
  );
}

function CardToneIcon({ tone }: { tone: StatusTone }) {
  if (tone === "error") {
    return (
      <AlertTriangle className="text-destructive mt-0.5 size-4 shrink-0" />
    );
  }
  if (tone === "warning") {
    return <AlertCircle className="text-warning mt-0.5 size-4 shrink-0" />;
  }
  return (
    <Loader2 className="text-primary mt-0.5 size-4 shrink-0 animate-spin" />
  );
}

export function StatusCenter({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  const status = useStatusCenter();
  const [open, setOpen] = useState(false);
  const { items, topItem, stats, statsLoading, statsError } = status;

  const hasActivity = items.some((item) => item.animated);
  const tooltipLabel = topItem
    ? t(topItem.titleKey)
    : t("status.library.title");
  const activeDescription =
    topItem?.description ??
    (topItem?.descriptionKey ? t(topItem.descriptionKey) : undefined);
  const activeProgress = topItem?.progress;
  const showIndeterminate =
    activeProgress === null && topItem?.tone === "activity";
  const extraCount = items.length > 1 ? items.length - 1 : 0;

  const relativeLastSync = stats?.lastSync
    ? formatRelativeTime(stats.lastSync)
    : null;

  const idleContent = (
    <>
      <div className="flex items-center gap-2">
        <LibraryBig className="text-muted-foreground size-4 shrink-0" />
        <span className="text-sm font-medium">{t("status.library.title")}</span>
      </div>
      {statsLoading ? (
        <div className="mt-2 flex flex-col gap-1.5">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ) : statsError || !stats ? (
        <p className="text-muted-foreground mt-1 text-xs">
          {t("status.library.statsUnavailable")}
        </p>
      ) : (
        <>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {stats.totalTracks === 0
              ? t("status.library.empty")
              : `${formatCount(stats.totalTracks)} ${t("status.library.tracksLabel")}`}
          </p>
          {stats.totalTracks > 0 && (
            <p className="text-muted-foreground text-xs">
              {t("status.library.albums", {
                count: stats.totalAlbums,
                formatted: formatCount(stats.totalAlbums),
              })}{" "}
              ·{" "}
              {t("status.library.artists", {
                count: stats.totalArtists,
                formatted: formatCount(stats.totalArtists),
              })}
            </p>
          )}
          <p className="text-muted-foreground mt-0.5 text-xs">
            {relativeLastSync
              ? t("status.library.lastSync", { time: relativeLastSync })
              : t("status.library.neverSynced")}
          </p>
        </>
      )}
    </>
  );

  const activeContent = topItem ? (
    <div className="flex items-start gap-2">
      <CardToneIcon tone={topItem.tone} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">
            {t(topItem.titleKey)}
          </span>
          {activeProgress !== undefined && activeProgress !== null && (
            <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
              {activeProgress}%
            </span>
          )}
        </div>
        {activeProgress !== undefined && activeProgress !== null ? (
          <Progress value={activeProgress} className="mt-2" />
        ) : showIndeterminate ? (
          <Progress indeterminate className="mt-2" />
        ) : null}
        {activeDescription && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
            {activeDescription}
          </p>
        )}
        {extraCount > 0 && (
          <p className="text-muted-foreground mt-1 text-xs">+{extraCount}</p>
        )}
      </div>
    </div>
  ) : null;

  if (collapsed) {
    return (
      <div className="flex shrink-0 justify-center border-t p-2">
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="bare"
                  size="icon-lg"
                  className={cn(
                    "relative",
                    hasActivity && "motion-safe:animate-pulse",
                  )}
                  aria-label={t("status.openWith", { status: tooltipLabel })}
                >
                  <LibraryBig />
                  {topItem && <StatusDot tone={topItem.tone} />}
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-56">
              <p>{tooltipLabel}</p>
              {!topItem && stats && (
                <p className="text-primary-foreground/80 text-xs">
                  {t("status.library.tracks", {
                    count: stats.totalTracks,
                    formatted: formatCount(stats.totalTracks),
                  })}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
          <PopoverContent
            side="right"
            align="end"
            className="w-80 p-0"
            aria-label={t("status.title")}
          >
            <StatusCenterContent
              status={status}
              onNavigate={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t p-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "bg-card hover:bg-muted/50 focus-visible:ring-ring/50 w-full rounded-xl border p-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
              topItem?.tone === "error" && "border-destructive/30",
              topItem?.tone === "warning" && "border-warning/30",
            )}
          >
            {topItem ? activeContent : idleContent}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="end"
          className="w-80 p-0"
          aria-label={t("status.title")}
        >
          <StatusCenterContent
            status={status}
            onNavigate={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
