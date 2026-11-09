import i18n from "@/i18n/config";

function locale(): string {
  return i18n.resolvedLanguage ?? "en";
}

function formatUnit(
  value: number,
  unit: Intl.NumberFormatOptions["unit"],
): string {
  return new Intl.NumberFormat(locale(), {
    style: "unit",
    unit,
    unitDisplay: "narrow",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCount(n: number): string {
  return new Intl.NumberFormat(locale()).format(n);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** i;
  const formatted = new Intl.NumberFormat(locale(), {
    maximumFractionDigits: i === 0 ? 0 : 1,
  }).format(value);
  return `${formatted} ${units[i]}`;
}

/** Clock format used by tracks and players, e.g. 3:07 or 1:02:03. */
export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/** Human total duration, e.g. 1h 20m / 5m / 30s. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${formatUnit(hours, "hour")} ${formatUnit(minutes, "minute")}`;
  }
  if (minutes > 0) return formatUnit(minutes, "minute");
  return formatUnit(total, "second");
}

/** Average track duration, always with seconds, e.g. 4m 12s. */
export function formatAvgDuration(seconds: number): string {
  if (seconds === 0) return formatUnit(0, "second");
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (minutes > 0) {
    return `${formatUnit(minutes, "minute")} ${formatUnit(secs, "second")}`;
  }
  return formatUnit(secs, "second");
}

/** Relative timestamp for status surfaces, e.g. "2 hours ago" / "now". */
export function formatRelativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const timestamp = new Date(iso).getTime();
  if (Number.isNaN(timestamp)) return null;
  const diffMs = timestamp - Date.now();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  if (abs < 60_000) return rtf.format(Math.round(diffMs / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), "minute");
  if (abs < 86_400_000)
    return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  if (abs < 2_592_000_000)
    return rtf.format(Math.round(diffMs / 86_400_000), "day");
  if (abs < 31_536_000_000)
    return rtf.format(Math.round(diffMs / 2_592_000_000), "month");
  return rtf.format(Math.round(diffMs / 31_536_000_000), "year");
}

/** Uptime with days/hours/minutes, e.g. 2d 3h 10m. */
export function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) {
    return `${formatUnit(d, "day")} ${formatUnit(h, "hour")} ${formatUnit(m, "minute")}`;
  }
  if (h > 0) return `${formatUnit(h, "hour")} ${formatUnit(m, "minute")}`;
  return formatUnit(m, "minute");
}
