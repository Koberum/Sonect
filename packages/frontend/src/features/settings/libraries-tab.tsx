import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Copy,
  FolderPlus,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { systemQueries, systemMutations } from "@/features/system/queries";
import type { DetectedLibrary, StorageSource } from "@/features/system/api";
import { LibrariesForm } from "./libraries-form";
import { DetectedLibraryRow, RegisteredLibraryRow } from "./library-rows";
import type { LibrarySourceFormValues } from "./library-source-form";

function composeSnippet(target?: DetectedLibrary): string {
  return `services:
  sonect:
    volumes:
      - /path/on/host:${target?.path ?? "/libraries/music"}:ro`;
}

export function LibrariesTab() {
  const { t } = useTranslation();
  const sourcesQuery = useQuery(systemQueries.storageSources());
  const detectedQuery = useQuery(systemQueries.detectedLibraries());
  const createMut = useMutation(systemMutations.createStorageSource());
  const updateMut = useMutation(systemMutations.updateStorageSource());
  const deleteMut = useMutation(systemMutations.deleteStorageSource());
  const refreshMut = useMutation(systemMutations.refreshStorageStats());
  const computeMut = useMutation(systemMutations.computeStorageStats());

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingSource, setEditingSource] = useState<StorageSource | undefined>(
    undefined,
  );
  const [deletingSource, setDeletingSource] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [snippetOpen, setSnippetOpen] = useState(false);

  const sources = sourcesQuery.data ?? [];
  const detected = (detectedQuery.data ?? []).filter((l) => !l.registered);
  const hasError = sourcesQuery.isError || detectedQuery.isError;

  const openAddDialog = () => {
    setEditingId(null);
    setEditingSource(undefined);
    setFormOpen(true);
  };

  const startEdit = (src: StorageSource) => {
    setEditingId(src.id);
    setEditingSource(src);
    setFormOpen(true);
  };

  const handleSave = async (data: LibrarySourceFormValues) => {
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, data });
        toast.success(t("settings.libraries.updated", "Library updated"));
      } else {
        await createMut.mutateAsync(data);
        toast.success(t("settings.libraries.created", "Library created"));
      }
      setFormOpen(false);
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          (editingId
            ? t("settings.libraries.updateError", "Failed to update library")
            : t("settings.libraries.createError", "Failed to create library")),
      );
    }
  };

  const handleAddDetected = async (lib: DetectedLibrary) => {
    try {
      await createMut.mutateAsync({ name: lib.name, path: lib.path });
      toast.success(t("settings.libraries.addedToast", "Library added"));
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.libraries.createError", "Failed to create library"),
      );
    }
  };

  const handleComputeStats = async (lib: DetectedLibrary) => {
    try {
      await computeMut.mutateAsync(lib.path);
      toast.success(t("settings.libraries.statsRefreshed", "Stats updated"));
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.libraries.refreshStatsError", "Failed to refresh stats"),
      );
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteMut.mutateAsync(id);
      toast.success(t("settings.libraries.deleted", "Library deleted"));
      setDeletingSource(null);
    } catch {
      toast.error(
        t("settings.libraries.deleteError", "Failed to delete library"),
      );
    }
  };

  const handleRefreshStats = async (id: number) => {
    try {
      await refreshMut.mutateAsync(id);
      toast.success(t("settings.libraries.statsRefreshed", "Stats updated"));
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.libraries.refreshStatsError", "Failed to refresh stats"),
      );
    }
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(composeSnippet(detected[0]));
      toast.success(t("settings.libraries.snippetCopied", "Snippet copied"));
    } catch {
      toast.error(t("settings.libraries.snippetCopyError", "Copy failed"));
    }
  };

  const retry = () => {
    if (sourcesQuery.isError) void sourcesQuery.refetch();
    if (detectedQuery.isError) void detectedQuery.refetch();
  };

  const skeleton = (
    <div className="space-y-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.libraries.title", "Libraries")}</CardTitle>
        <CardDescription>
          {t(
            "settings.libraries.description",
            "Folders bind-mounted into the container and indexed by Sonect.",
          )}
        </CardDescription>
        <CardAction>
          <Button onClick={openAddDialog}>
            <Plus />
            {t("settings.libraries.addManual", "Add manually")}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasError && (
          <div
            role="alert"
            className="border-destructive/50 bg-destructive/10 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <p className="text-destructive text-sm">
              {t("settings.libraries.loadError", "Couldn't load libraries")}
            </p>
            <Button variant="outline" size="sm" onClick={retry}>
              {t("common.retry", "Retry")}
            </Button>
          </div>
        )}

        <section className="space-y-3">
          {sourcesQuery.isPending ? (
            skeleton
          ) : sources.length === 0 ? (
            <EmptyState
              icon={FolderPlus}
              title={t(
                "settings.libraries.noSources",
                "No libraries configured",
              )}
              description={t(
                "settings.libraries.noSourcesDescription",
                "Bind-mount a folder into the container, then register it here.",
              )}
              action={
                <Button variant="outline" onClick={openAddDialog}>
                  <Plus />
                  {t("settings.libraries.addManual", "Add manually")}
                </Button>
              }
            />
          ) : (
            sources.map((src) => (
              <RegisteredLibraryRow
                key={src.id}
                source={src}
                isRefreshing={
                  refreshMut.isPending && refreshMut.variables === src.id
                }
                onRefresh={() => handleRefreshStats(src.id)}
                onEdit={() => startEdit(src)}
                onDelete={() =>
                  setDeletingSource({ id: src.id, name: src.name })
                }
              />
            ))
          )}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-medium">
              <HardDrive className="text-muted-foreground size-4" />
              {t("settings.libraries.detected", "Detected libraries")}
            </h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void detectedQuery.refetch()}
                  disabled={detectedQuery.isFetching}
                  aria-label={t(
                    "settings.libraries.refreshDetected",
                    "Refresh list",
                  )}
                >
                  <RefreshCw
                    className={cn(detectedQuery.isFetching && "animate-spin")}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t("settings.libraries.refreshDetected", "Refresh list")}
              </TooltipContent>
            </Tooltip>
          </div>
          {detectedQuery.isPending ? (
            skeleton
          ) : detected.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t(
                "settings.libraries.noDetected",
                "No folders detected under the music directory.",
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {detected.map((lib) => (
                <DetectedLibraryRow
                  key={lib.path}
                  lib={lib}
                  isAdding={
                    createMut.isPending &&
                    createMut.variables?.path === lib.path
                  }
                  isComputing={
                    computeMut.isPending && computeMut.variables === lib.path
                  }
                  onAdd={() => handleAddDetected(lib)}
                  onCompute={() => handleComputeStats(lib)}
                />
              ))}
            </div>
          )}
        </section>

        <div className="rounded-lg border">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium"
            onClick={() => setSnippetOpen((open) => !open)}
            aria-expanded={snippetOpen}
          >
            {t("settings.libraries.snippetTitle", "How to add more folders")}
            <ChevronDown
              className={cn(
                "text-muted-foreground size-4 transition-transform",
                snippetOpen && "rotate-180",
              )}
            />
          </button>
          {snippetOpen && (
            <div className="space-y-2 border-t p-3">
              <p className="text-muted-foreground text-xs">
                {t(
                  "settings.libraries.snippetHint",
                  "The host bind-mounts a folder into the container; register it here.",
                )}
              </p>
              <div className="flex items-start gap-2">
                <pre className="bg-muted flex-1 overflow-x-auto rounded-md p-3 font-mono text-xs">
                  {composeSnippet(detected[0])}
                </pre>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={copySnippet}
                      aria-label={t(
                        "settings.libraries.copySnippet",
                        "Copy compose snippet",
                      )}
                    >
                      <Copy />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t(
                      "settings.libraries.copySnippet",
                      "Copy compose snippet",
                    )}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <LibrariesForm
        key={editingId ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSave={handleSave}
        initialValues={editingSource}
        editingId={editingId}
      />

      <AlertDialog
        open={deletingSource !== null}
        onOpenChange={(open) => {
          if (!open && !deleteMut.isPending) {
            setDeletingSource(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("settings.libraries.deleteTitle", "Delete Library?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.libraries.deleteConfirm", {
                name: deletingSource?.name ?? "",
                defaultValue:
                  'Are you sure you want to delete "{{name}}"? This cannot be undone.',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMut.isPending}>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deletingSource) void handleDelete(deletingSource.id);
              }}
              disabled={deleteMut.isPending}
              className={buttonVariants({ variant: "destructive" })}
            >
              {deleteMut.isPending && <Loader2 className="animate-spin" />}
              {t("settings.libraries.deleteButton", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
