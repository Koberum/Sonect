import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { formatBytes, formatCount } from "@/lib/format";

interface LibraryStatsProps {
  stats?: {
    file_count?: number;
    dir_count?: number;
    total_size?: number;
  } | null;
  className?: string;
}

export function LibraryStats({ stats, className }: LibraryStatsProps) {
  const { t } = useTranslation();
  if (!stats) return null;

  return (
    <p className={cn("text-muted-foreground text-sm tabular-nums", className)}>
      {t("settings.libraries.stats", {
        files: formatCount(stats.file_count ?? 0),
        folders: formatCount(stats.dir_count ?? 0),
        size: formatBytes(stats.total_size ?? 0),
      })}
    </p>
  );
}
