import { useTranslation } from "react-i18next";
import {
  Calculator,
  Folder,
  HardDrive,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DetectedLibrary, StorageSource } from "@/features/system/api";
import { LibraryStats } from "./library-stats";

interface RegisteredLibraryRowProps {
  source: StorageSource;
  isRefreshing: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function RegisteredLibraryRow({
  source,
  isRefreshing,
  onRefresh,
  onEdit,
  onDelete,
}: RegisteredLibraryRowProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <Folder className="text-muted-foreground size-5 shrink-0" />
      <div className="min-w-0 flex-1 basis-48">
        <div className="truncate font-medium">{source.name}</div>
        <div className="text-muted-foreground truncate font-mono text-xs">
          {source.path}
        </div>
        <LibraryStats stats={source} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label={t("settings.libraries.refreshStats", "Refresh stats")}
            >
              {isRefreshing ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("settings.libraries.refreshStats", "Refresh stats")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              aria-label={t("settings.libraries.edit", "Edit")}
            >
              <Pencil />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("settings.libraries.edit", "Edit")}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              aria-label={t("settings.libraries.deleteButton", "Delete")}
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {t("settings.libraries.deleteButton", "Delete")}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

interface DetectedLibraryRowProps {
  lib: DetectedLibrary;
  isAdding: boolean;
  isComputing: boolean;
  onAdd: () => void;
  onCompute: () => void;
}

export function DetectedLibraryRow({
  lib,
  isAdding,
  isComputing,
  onAdd,
  onCompute,
}: DetectedLibraryRowProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
      <HardDrive className="text-muted-foreground size-5 shrink-0" />
      <div className="min-w-0 flex-1 basis-48">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate font-medium">{lib.name}</span>
          {lib.isMount && (
            <Badge variant="secondary" className="shrink-0">
              {t("settings.libraries.isMount", "Mount")}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground truncate font-mono text-xs">
          {lib.path}
        </div>
        {lib.stats ? (
          <LibraryStats stats={lib.stats} />
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("settings.libraries.statsUnavailable", "Stats not available")}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!lib.stats && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCompute}
            disabled={isComputing}
          >
            {isComputing ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Calculator />
            )}
            {isComputing
              ? t("settings.libraries.computing", "Computing…")
              : t("settings.libraries.computeStats", "Compute stats")}
          </Button>
        )}
        <Button size="sm" onClick={onAdd} disabled={isAdding}>
          {isAdding ? <Loader2 className="animate-spin" /> : <Plus />}
          {t("settings.libraries.add", "Add")}
        </Button>
      </div>
    </div>
  );
}
