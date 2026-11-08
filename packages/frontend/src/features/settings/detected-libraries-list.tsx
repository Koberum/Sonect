import { useTranslation } from "react-i18next";
import { FolderSearch } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import type { DetectedLibrary } from "@/features/system/api";
import { DetectedLibraryRow } from "./library-rows";

interface DetectedLibrariesListProps {
  libraries: DetectedLibrary[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  isAdding: (library: DetectedLibrary) => boolean;
  isComputing: (library: DetectedLibrary) => boolean;
  onAdd: (library: DetectedLibrary) => void;
  onCompute: (library: DetectedLibrary) => void;
  skeletonRows?: number;
}

/** Detected-folder list with its loading, error and empty states. */
export function DetectedLibrariesList({
  libraries,
  isPending,
  isError,
  onRetry,
  isAdding,
  isComputing,
  onAdd,
  onCompute,
  skeletonRows = 2,
}: DetectedLibrariesListProps) {
  const { t } = useTranslation();

  if (isError) {
    return (
      <Alert
        variant="destructive"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        <AlertDescription>
          {t(
            "settings.libraries.loadDetectedError",
            "Couldn't load detected folders",
          )}
        </AlertDescription>
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("common.retry", "Retry")}
        </Button>
      </Alert>
    );
  }

  if (isPending) {
    return (
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: skeletonRows }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (libraries.length === 0) {
    return (
      <EmptyState
        icon={FolderSearch}
        title={t(
          "settings.libraries.noDetected",
          "No folders detected under the music directory.",
        )}
        className="py-6"
      />
    );
  }

  return (
    <ItemGroup>
      {libraries.map((library) => (
        <DetectedLibraryRow
          key={library.path}
          lib={library}
          isAdding={isAdding(library)}
          isComputing={isComputing(library)}
          onAdd={() => onAdd(library)}
          onCompute={() => onCompute(library)}
        />
      ))}
    </ItemGroup>
  );
}
