import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  getHardwareUsage,
  type HardwareUsage,
} from "@/features/apis/systemApis";
import { Cpu, MemoryStick } from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function HardwareMonitor() {
  const { t } = useTranslation();
  const [usage, setUsage] = useState<HardwareUsage | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await getHardwareUsage();
        setUsage(data);
      } catch {
        // silently ignore
      }
    };
    fetch();
    intervalRef.current = setInterval(fetch, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (!usage) {
    return (
      <div className="text-muted-foreground text-center text-sm">
        {t("settings.debug.hardware.loading")}
      </div>
    );
  }

  const cpuColor =
    usage.cpu.usage > 80
      ? "bg-red-500"
      : usage.cpu.usage > 50
        ? "bg-yellow-500"
        : "bg-green-500";

  const ramColor =
    usage.ram.usagePercent > 80
      ? "bg-red-500"
      : usage.ram.usagePercent > 50
        ? "bg-yellow-500"
        : "bg-green-500";

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <Cpu className="h-3.5 w-3.5" />
            {t("settings.debug.hardware.cpu")}
          </span>
          <span className="tabular-nums">{usage.cpu.usage}%</span>
        </div>
        <ProgressBar value={usage.cpu.usage} color={cpuColor} />
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

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <MemoryStick className="h-3.5 w-3.5" />
            {t("settings.debug.hardware.ram")}
          </span>
          <span className="tabular-nums">
            {formatBytes(usage.ram.used)} / {formatBytes(usage.ram.total)}
          </span>
        </div>
        <ProgressBar value={usage.ram.usagePercent} color={ramColor} />
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>
            {t("settings.debug.hardware.free")} {formatBytes(usage.ram.free)}
          </span>
          <span>{usage.ram.usagePercent}%</span>
        </div>
      </div>

      <div className="text-muted-foreground border-t pt-2 text-xs">
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
