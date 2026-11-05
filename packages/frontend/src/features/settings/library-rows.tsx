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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
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
    <Item variant="outline" size="sm" className="p-3">
      <ItemMedia variant="icon">
        <Folder />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="max-w-full truncate">{source.name}</ItemTitle>
        <ItemDescription className="truncate font-mono text-xs">
          {source.path}
        </ItemDescription>
        <LibraryStats stats={source} />
      </ItemContent>
      <ItemActions className="basis-full justify-end sm:basis-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="bare"
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
              variant="bare"
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
              variant="bare"
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
      </ItemActions>
    </Item>
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
    <Item variant="outline" size="sm" className="p-3">
      <ItemMedia variant="icon">
        <HardDrive />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="max-w-full flex-wrap">
          <span className="min-w-0 truncate">{lib.name}</span>
          {lib.isMount && (
            <Badge variant="secondary" className="shrink-0">
              {t("settings.libraries.isMount", "Mount")}
            </Badge>
          )}
        </ItemTitle>
        <ItemDescription className="truncate font-mono text-xs">
          {lib.path}
        </ItemDescription>
        {lib.stats ? (
          <LibraryStats stats={lib.stats} />
        ) : (
          <p className="text-muted-foreground text-sm">
            {t("settings.libraries.statsUnavailable", "Stats not available")}
          </p>
        )}
      </ItemContent>
      <ItemActions className="basis-full justify-end sm:basis-auto">
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
      </ItemActions>
    </Item>
  );
}
