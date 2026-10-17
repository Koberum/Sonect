import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Folder,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { useQuery, useMutation } from "@tanstack/react-query";
import { systemQueries, systemMutations } from "@/features/system/queries";
import type { StorageSource } from "@/features/system/api";
import { LibrariesForm } from "./libraries-form";
import { LibraryStats } from "./library-stats";
import type { LibrarySourceFormValues } from "./library-source-form";

const COMPOSE_SNIPPET = `services:
  sonect:
    volumes:
      - /host/path/to/music:/libraries/music:ro`;

export function LibrariesTab() {
  const { t } = useTranslation();
  const { data: sources = [], isPending: loading } = useQuery(
    systemQueries.storageSources(),
  );
  const { data: detected = [] } = useQuery(systemQueries.detectedLibraries());
  const createMut = useMutation(systemMutations.createStorageSource());
  const updateMut = useMutation(systemMutations.updateStorageSource());
  const deleteMut = useMutation(systemMutations.deleteStorageSource());
  const refreshMut = useMutation(systemMutations.refreshStorageStats());

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingSource, setEditingSource] = useState<StorageSource | undefined>(
    undefined,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState("");

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

  const handleDelete = async (id: number) => {
    try {
      await deleteMut.mutateAsync(id);
      toast.success(t("settings.libraries.deleted", "Library deleted"));
      setDeletingId(null);
      setDeletingName("");
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
      await navigator.clipboard.writeText(COMPOSE_SNIPPET);
      toast.success(t("settings.libraries.snippetCopied", "Snippet copied"));
    } catch {
      toast.error(t("settings.libraries.snippetCopyError", "Copy failed"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.libraries.title", "Libraries")}</CardTitle>
        <CardDescription>
          {t(
            "settings.libraries.description",
            "Folders bind-mounted into the container and scanned by MPD.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-muted-foreground text-sm">
              {t("settings.libraries.noSources", "No libraries configured")}
            </p>
            <p className="text-muted-foreground text-xs">
              {t(
                "settings.libraries.noSourcesDescription",
                "Bind-mount a folder into the container, then register it here.",
              )}
            </p>
            <Button variant="outline" onClick={openAddDialog} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.libraries.addSource", "Add Library")}
            </Button>
          </div>
        ) : (
          <>
            {sources.map((src) => (
              <div
                key={src.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Folder className="text-muted-foreground h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{src.name}</span>
                  </div>
                  <div className="text-muted-foreground truncate font-mono text-xs">
                    {src.path}
                  </div>
                  <LibraryStats stats={src} />
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRefreshStats(src.id)}
                    disabled={
                      refreshMut.isPending && refreshMut.variables === src.id
                    }
                    aria-label={t(
                      "settings.libraries.refreshStats",
                      "Refresh stats",
                    )}
                  >
                    {refreshMut.isPending && refreshMut.variables === src.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">
                      {refreshMut.isPending && refreshMut.variables === src.id
                        ? t("settings.libraries.refreshing", "Refreshing…")
                        : t("settings.libraries.refreshStats", "Refresh stats")}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(src)}
                  >
                    {t("settings.libraries.edit", "Edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeletingId(src.id);
                      setDeletingName(src.name);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.libraries.addSource", "Add Library")}
            </Button>
          </>
        )}

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <HardDrive className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="text-sm font-medium">
                {t("settings.libraries.detected", "Detected libraries")}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={copySnippet}>
              <Copy className="mr-2 h-3.5 w-3.5" />
              {t("settings.libraries.copySnippet", "Copy compose snippet")}
            </Button>
          </div>
          {detected.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              {t(
                "settings.libraries.noDetected",
                "No folders detected under the music directory.",
              )}
            </p>
          ) : (
            <ul className="space-y-2">
              {detected.map((lib) => (
                <li
                  key={lib.path}
                  className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${
                    lib.registered ? "opacity-60" : ""
                  }`}
                >
                  <span className="truncate text-sm font-medium">
                    {lib.name}
                  </span>
                  {lib.isMount && (
                    <Badge variant="secondary">
                      {t("settings.libraries.isMount", "Mount")}
                    </Badge>
                  )}
                  {lib.registered && (
                    <Badge variant="outline">
                      {t("settings.libraries.alreadyAdded", "Already added")}
                    </Badge>
                  )}
                  <span className="text-muted-foreground w-full truncate font-mono text-xs">
                    {lib.path}
                  </span>
                  {lib.stats && <LibraryStats stats={lib.stats} />}
                </li>
              ))}
            </ul>
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
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingId(null);
            setDeletingName("");
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
                name: deletingName,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && handleDelete(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("settings.libraries.deleteButton", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
