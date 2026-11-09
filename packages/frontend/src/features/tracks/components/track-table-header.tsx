import { useTranslation } from "react-i18next";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Filter as FilterIcon,
} from "lucide-react";
import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QualityOption, QualitySort } from "../quality";

interface TrackTableHeaderProps {
  showQuality?: boolean;
  qualityOptions?: QualityOption[];
  qualityFilter?: string | null;
  qualitySort?: QualitySort;
  qualityControlsEnabled?: boolean;
  onQualityFilterChange?: (key: string | null) => void;
  onQualitySortChange?: (sort: QualitySort) => void;
}

export function TrackTableHeader({
  showQuality = false,
  qualityOptions = [],
  qualityFilter = null,
  qualitySort = "none",
  qualityControlsEnabled = false,
  onQualityFilterChange,
  onQualitySortChange,
}: TrackTableHeaderProps) {
  const { t } = useTranslation();

  const cycleQualitySort = () => {
    const next: QualitySort =
      qualitySort === "none" ? "desc" : qualitySort === "desc" ? "asc" : "none";
    onQualitySortChange?.(next);
  };

  return (
    <TableHeader>
      <TableRow>
        <TableHead className="w-10 text-center">
          {t("album.trackNumber")}
        </TableHead>
        <TableHead>{t("album.title")}</TableHead>
        {showQuality && (
          <TableHead
            aria-sort={
              qualitySort === "desc"
                ? "descending"
                : qualitySort === "asc"
                  ? "ascending"
                  : "none"
            }
            className="hidden w-40 md:table-cell"
          >
            <div className="flex items-center justify-end gap-1">
              {qualityControlsEnabled ? (
                <button
                  type="button"
                  onClick={cycleQualitySort}
                  aria-label={t("trackTable.sortQuality")}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
                >
                  {t("album.quality")}
                  {qualitySort === "desc" ? (
                    <ArrowDown className="size-4" />
                  ) : qualitySort === "asc" ? (
                    <ArrowUp className="size-4" />
                  ) : (
                    <ChevronsUpDown className="size-4" />
                  )}
                </button>
              ) : (
                <span className="text-sm font-medium">
                  {t("album.quality")}
                </span>
              )}
              {qualityControlsEnabled && qualityOptions.length > 1 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="bare"
                      size="icon-sm"
                      aria-label={t("trackTable.filterQuality")}
                    >
                      <FilterIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>
                      {t("trackTable.filterQuality")}
                    </DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={qualityFilter ?? "all"}
                      onValueChange={(value) =>
                        onQualityFilterChange?.(value === "all" ? null : value)
                      }
                    >
                      <DropdownMenuRadioItem value="all">
                        {t("trackTable.allQualities")}
                      </DropdownMenuRadioItem>
                      {qualityOptions.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.key}
                          value={option.key}
                        >
                          {option.label}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </TableHead>
        )}
        <TableHead className="w-14 text-right sm:w-20">
          {t("album.duration")}
        </TableHead>
        <TableHead className="w-10" />
      </TableRow>
    </TableHeader>
  );
}
