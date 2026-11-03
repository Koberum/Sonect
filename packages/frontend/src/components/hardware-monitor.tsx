import { useTranslation } from "react-i18next";
import { Cpu, MemoryStick } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { systemQueries } from "@/features/system/queries";
import { formatBytes } from "@/lib/format";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function HardwareMonitor() {
  const { t } = useTranslation();
  const { data: usage } = useQuery(systemQueries.hardwareUsage(true));

  if (!usage) {
    return (
      <div className="flex flex-col gap-4" aria-hidden="true">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-2 w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-2 w-full" />
        </div>
      </div>
    );
  }

  const cpuColor =
    usage.cpu.usage > 80
      ? "bg-destructive"
      : usage.cpu.usage > 50
        ? "bg-warning"
        : "bg-success";

  const ramColor =
    usage.ram.usagePercent > 80
      ? "bg-destructive"
      : usage.ram.usagePercent > 50
        ? "bg-warning"
        : "bg-success";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Cpu className="size-4" />
            {t("settings.debug.hardware.cpu")}
          </span>
          <span className="tabular-nums">{usage.cpu.usage}%</span>
        </div>
        <Progress value={usage.cpu.usage} indicatorClassName={cpuColor} />
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>
            {t("settings.debug.hardware.cores", { count: usage.cpu.cores })}
          </span>
          <span>
            {t("settings.debug.hardware.loadAvg")}{" "}
            {usage.cpu.loadAvg.map((v) => v.toFixed(1)).join(" / ")}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 font-medium">
            <MemoryStick className="size-4" />
            {t("settings.debug.hardware.ram")}
          </span>
          <span className="tabular-nums">
            {formatBytes(usage.ram.used)} / {formatBytes(usage.ram.total)}
          </span>
        </div>
        <Progress
          value={usage.ram.usagePercent}
          indicatorClassName={ramColor}
        />
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>
            {t("settings.debug.hardware.free")} {formatBytes(usage.ram.free)}
          </span>
          <span>{usage.ram.usagePercent}%</span>
        </div>
      </div>

      <Separator />

      <div className="text-muted-foreground flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <span>{t("settings.debug.hardware.processRss")}</span>
          <span className="tabular-nums">{formatBytes(usage.process.rss)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t("settings.debug.hardware.uptime")}</span>
          <span className="tabular-nums">{formatUptime(usage.uptime)}</span>
        </div>
      </div>
    </div>
  );
}
