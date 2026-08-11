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
import { LibrariesTypeSelect, type SourceType } from "./libraries-type-select";
import { LibrariesForm } from "./libraries-form";

const typeIcons: Record<SourceType, typeof Server> = {
  smb: Server,
  nfs: HardDrive,
  local: Folder,
};

const typeBadgeLabels: Record<SourceType, string> = {
  smb: "SMB",
  nfs: "NFS",
  local: "Local",
};

const formatCount = (n: number): string => n.toLocaleString();

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** i;
  return `${value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[i]}`;
}

type DialogStep = "closed" | "select-type" | "form";

export function LibrariesTab() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [mounts, setMounts] = useState<MountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogStep, setDialogStep] = useState<DialogStep>("closed");
  const [selectedType, setSelectedType] = useState<SourceType>("smb");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingSource, setEditingSource] = useState<StorageSource | undefined>(
    undefined,
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingName, setDeletingName] = useState("");

  const supportsMount = (src: StorageSource) => src.type !== "local";

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
        t("settings.libraries.loadError", "Failed to load library data"),
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
          t("settings.libraries.loadError", "Failed to load library data"),
        );
      }
      setLoading(false);
    };
    load();
  }, [t]);

  const openAddDialog = () => {
    setEditingId(null);
    setEditingSource(undefined);
    setSelectedType("smb");
    setDialogStep("select-type");
  };

  const startEdit = (src: StorageSource) => {
    setEditingId(src.id);
    setEditingSource(src);
    setSelectedType(src.type as SourceType);
    setDialogStep("form");
  };

  const handleTypeSelect = (type: SourceType) => {
    setSelectedType(type);
    setDialogStep("form");
  };

  const handleFormBack = () => {
    setDialogStep("select-type");
  };

  const handleSave = async (data: {
    name: string;
    type: SourceType;
    uri: string;
    mount_path: string;
    username?: string;
    password?: string;
  }) => {
    try {
      if (editingId) {
        await updateStorageSource(editingId, data);
        toast.success(t("settings.libraries.updated", "Library updated"));
      } else {
        await createStorageSource(data);
        toast.success(t("settings.libraries.created", "Library created"));
      }
      setDialogStep("closed");
      reloadStorage();
    } catch {
      toast.error(
        editingId
          ? t("settings.libraries.updateError", "Failed to update library")
          : t("settings.libraries.createError", "Failed to create library"),
      );
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStorageSource(id);
      toast.success(t("settings.libraries.deleted", "Library deleted"));
      setDeletingId(null);
      setDeletingName("");
      reloadStorage();
    } catch {
      toast.error(
        t("settings.libraries.deleteError", "Failed to delete library"),
      );
    }
  };

  const handleMount = async (id: number) => {
    try {
      const result = await mountStorageSource(id);
      if (result.success) {
        toast.success(t("settings.libraries.mounted", "Mounted"));
        reloadStorage();
      } else {
        toast.error(
          result.error ?? t("settings.libraries.mountError", "Mount failed"),
        );
      }
    } catch {
      toast.error(t("settings.libraries.mountError", "Failed to mount"));
    }
  };

  const handleUnmount = async (id: number) => {
    try {
      await unmountStorageSource(id);
      toast.success(t("settings.libraries.unmounted", "Unmounted"));
      reloadStorage();
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.libraries.unmountError", "Failed to unmount"),
      );
    }
  };

  const isMounted = (mountPath: string) =>
    mounts.some((m) => m.path === mountPath);

  const getSourceDescription = (src: StorageSource) => {
    const mountSubpath = src.mount_path.replace(/^\/opt\/sonect\/music\/?/, "");
    if (src.type === "local") {
      return `${src.uri} → /opt/sonect/music/${mountSubpath}`;
    }
    return `${src.uri} → /opt/sonect/music/${mountSubpath}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.libraries.title", "Libraries")}</CardTitle>
        <CardDescription>
          {t(
            "settings.libraries.description",
            "Manage your music library sources.",
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
                "Add an SMB, NFS, or local source for your music library.",
              )}
            </p>
            <Button variant="outline" onClick={openAddDialog} className="mt-2">
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.libraries.addSource", "Add Library")}
            </Button>
          </div>
        ) : (
          <>
            {sources.map((src) => {
              const TypeIcon = typeIcons[src.type as SourceType] ?? Folder;
              const mounted = isMounted(src.mount_path);
              return (
                <div
                  key={src.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <TypeIcon className="text-muted-foreground h-5 w-5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{src.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {typeBadgeLabels[src.type as SourceType] ?? src.type}
                      </Badge>

                      {supportsMount(src) && (
                        <Badge variant={mounted ? "default" : "secondary"}>
                          {mounted
                            ? t("settings.libraries.mounted", "Mounted")
                            : t("settings.libraries.unmounted", "Unmounted")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {getSourceDescription(src)}
                    </div>
                    {typeof src.file_count === "number" && (
                      <div className="text-muted-foreground truncate text-xs">
                        {t("settings.libraries.stats", {
                          files: formatCount(src.file_count),
                          folders: formatCount(src.dir_count ?? 0),
                          size: formatBytes(src.total_size ?? 0),
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {supportsMount(src) &&
                      (mounted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnmount(src.id)}
                        >
                          {t("settings.libraries.unmount", "Unmount")}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMount(src.id)}
                        >
                          {t("settings.libraries.mount", "Mount")}
                        </Button>
                      ))}
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
              );
            })}
            <Button variant="outline" onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t("settings.libraries.addSource", "Add Library")}
            </Button>
          </>
        )}
      </CardContent>

      <LibrariesTypeSelect
        open={dialogStep === "select-type"}
        onOpenChange={(open) => {
          if (!open) setDialogStep("closed");
        }}
        onSelect={handleTypeSelect}
      />

      <LibrariesForm
        key={editingId ?? `new-${selectedType}`}
        open={dialogStep === "form"}
        onOpenChange={(open) => {
          if (!open) setDialogStep("closed");
        }}
        onSave={handleSave}
        onBack={handleFormBack}
        sourceType={selectedType}
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
