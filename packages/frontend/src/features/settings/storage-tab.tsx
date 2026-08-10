import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Folder, HardDrive, Loader2, Plus, Server, Trash2 } from "lucide-react";
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
import {
  getStorageSources,
  createStorageSource,
  updateStorageSource,
  deleteStorageSource,
  mountStorageSource,
  unmountStorageSource,
  getActiveMounts,
  type StorageSource,
  type MountInfo,
} from "@/features/apis/systemApis";
import { StorageSourceForm } from "@/features/storage/storage-source-form";

export function StorageTab() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [mounts, setMounts] = useState<MountInfo[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingSource, setEditingSource] = useState<StorageSource | undefined>(
    undefined,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState("");

  const reloadStorage = async () => {
    try {
      const [src, mnt] = await Promise.all([
        getStorageSources(),
        getActiveMounts(),
      ]);
      setSources(src);
      setMounts(mnt);
    } catch {
      toast.error(
        t("settings.storage.loadError", "Failed to load storage data"),
      );
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [src, mnt] = await Promise.all([
          getStorageSources(),
          getActiveMounts(),
        ]);
        setSources(src);
        setMounts(mnt);
      } catch {
        toast.error(
          t("settings.storage.loadError", "Failed to load storage data"),
        );
      }
      setLoading(false);
    };
    load();
  }, [t]);

  const openAddDialog = () => {
    setEditingId(null);
    setEditingSource(undefined);
    setDialogOpen(true);
  };

  const startEdit = (src: StorageSource) => {
    setEditingId(src.id);
    setEditingSource(src);
    setDialogOpen(true);
  };

  const handleSave = async (data: {
    name: string;
    type: "smb" | "nfs" | "local";
    uri: string;
    mount_path: string;
    username?: string;
    password?: string;
  }) => {
    try {
      if (editingId) {
        await updateStorageSource(editingId, data);
        toast.success(t("settings.storage.updated", "Storage source updated"));
      } else {
        await createStorageSource(data);
        toast.success(t("settings.storage.created", "Storage source created"));
      }
      setDialogOpen(false);
      reloadStorage();
    } catch {
      toast.error(
        editingId
          ? t("settings.storage.updateError", "Failed to update storage source")
          : t(
              "settings.storage.createError",
              "Failed to create storage source",
            ),
      );
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStorageSource(id);
      toast.success(t("settings.storage.deleted", "Storage source deleted"));
      setDeletingId(null);
      setDeletingName("");
      reloadStorage();
    } catch {
      toast.error(
        t("settings.storage.deleteError", "Failed to delete storage source"),
      );
    }
  };

  const handleMount = async (id: number) => {
    try {
      const result = await mountStorageSource(id);
      if (result.success) {
        toast.success(t("settings.storage.mounted", "Mounted"));
        reloadStorage();
      } else {
        toast.error(
          result.error ?? t("settings.storage.mountError", "Mount failed"),
        );
      }
    } catch {
      toast.error(t("settings.storage.mountError", "Failed to mount"));
    }
  };

  const handleUnmount = async (id: number) => {
    try {
      await unmountStorageSource(id);
      toast.success(t("settings.storage.unmounted", "Unmounted"));
      reloadStorage();
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.storage.unmountError", "Failed to unmount"),
      );
    }
  };

  const isMounted = (mountPath: string) =>
    mounts.some((m) => m.path === mountPath);

  const typeIcons = {
    smb: Server,
    nfs: HardDrive,
    local: Folder,
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.storage.title", "Storage")}</CardTitle>
        <CardDescription>
          {t("settings.storage.description", "Manage SMB/NFS music sources.")}
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
              {t("settings.storage.noSources", "No storage sources configured")}
            </p>
            <p className="text-muted-foreground text-xs">
              {t(
                "settings.storage.noSourcesDescription",
                "Add an SMB, NFS, or local source to expand your music library.",
              )}
            </p>
            <Button variant="outline" onClick={openAddDialog} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.storage.addSource", "Add Source")}
            </Button>
          </div>
        ) : (
          <>
            {sources.map((src) => {
              const TypeIcon = typeIcons[src.type];
              const mounted = isMounted(src.mount_path);
              return (
                <div
                  key={src.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <TypeIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{src.name}</span>
                      <Badge variant={mounted ? "default" : "secondary"}>
                        {mounted
                          ? t("settings.storage.mounted", "Mounted")
                          : t("settings.storage.unmounted", "Unmounted")}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {src.type.toUpperCase()} — {src.uri} → {src.mount_path}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {mounted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnmount(src.id)}
                      >
                        {t("settings.storage.unmount", "Unmount")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMount(src.id)}
                      >
                        {t("settings.storage.mount", "Mount")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(src)}
                    >
                      {t("settings.storage.edit", "Edit")}
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
              );
            })}
            <Button variant="outline" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.storage.addSource", "Add Source")}
            </Button>
          </>
        )}
      </CardContent>

      <StorageSourceForm
        key={editingId ?? "new"}
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) setDialogOpen(false);
        }}
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
              {t("settings.storage.deleteTitle", "Delete Storage Source?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.storage.deleteConfirm", {
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
              {t("settings.storage.deleteButton", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
