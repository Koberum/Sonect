import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Folder, HardDrive, Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StorageSource } from "@/features/apis/systemApis";
import type { SourceType } from "./libraries-type-select";

interface LibrariesFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    type: SourceType;
    uri: string;
    mount_path: string;
    username?: string;
    password?: string;
  }) => Promise<void>;
  onBack: () => void;
  sourceType: SourceType;
  initialValues?: StorageSource;
  editingId?: number | null;
}

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function LibrariesForm({
  open,
  onOpenChange,
  onSave,
  onBack,
  sourceType,
  initialValues,
  editingId,
}: LibrariesFormProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    uri:
      sourceType === "local"
        ? (initialValues?.uri ?? "")
        : (initialValues?.uri ?? ""),
    mount_path:
      initialValues?.mount_path.replace(/^\/opt\/sonect\/music\/?/, "") ?? "",
    username: initialValues?.username ?? "",
    password: "",
  });
  const [autoSlug, setAutoSlug] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (autoSlug && form.name) {
      setForm((prev) => ({ ...prev, mount_path: slugify(prev.name) }));
    }
  }, [form.name, autoSlug]);

  const TypeIcon = typeIcons[sourceType];

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!form.uri.trim()) errs.uri = "Required";
    if (!form.mount_path.trim()) errs.mount_path = "Required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFieldBlur = (field: string) => {
    setErrors((prev) => {
      const val = form[field as keyof typeof form];
      if (typeof val === "string" && !val.trim()) {
        return { ...prev, [field]: "Required" };
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({ ...form, type: sourceType });
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (field: string) =>
    errors[field] ? "border-red-500 focus-visible:ring-red-500" : "";

  const addressLabel =
    sourceType === "smb"
      ? t("settings.libraries.smbAddress", "SMB Address")
      : t("settings.libraries.nfsAddress", "NFS Address");

  const addressPlaceholder =
    sourceType === "smb"
      ? t(
          "settings.libraries.smbAddressPlaceholder",
          "smb://192.168.1.100/music",
        )
      : t(
          "settings.libraries.nfsAddressPlaceholder",
          "192.168.1.100:/export/music",
        );

  const addressHint =
    sourceType === "smb"
      ? t(
          "settings.libraries.smbAddressHint",
          "Use //server/share or smb://server/share format",
        )
      : t(
          "settings.libraries.nfsAddressHint",
          "Use server:/export/path format",
        );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingId
              ? t("settings.libraries.edit", "Edit Library")
              : t("settings.libraries.addSource", "Add Library")}
            <Badge variant="secondary" className="gap-1">
              <TypeIcon className="h-3 w-3" />
              {typeBadgeLabels[sourceType]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {t(
              "settings.libraries.formDescription",
              "Fill in the details for your library source.",
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lib-name">
              {t("settings.libraries.name", "Name")}
            </Label>
            <Input
              id="lib-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => handleFieldBlur("name")}
              placeholder={t("settings.libraries.namePlaceholder", "My Music")}
              className={fieldClass("name")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          {sourceType === "local" ? (
            <div className="space-y-2">
              <Label htmlFor="lib-localpath">
                {t("settings.libraries.localPath", "Folder Path")}
              </Label>
              <Input
                id="lib-localpath"
                value={form.uri}
                onChange={(e) => setForm({ ...form, uri: e.target.value })}
                onBlur={() => handleFieldBlur("uri")}
                placeholder={t(
                  "settings.libraries.localPathPlaceholder",
                  "/mnt/usb/music",
                )}
                className={fieldClass("uri")}
              />
              {errors.uri && (
                <p className="mt-1 text-xs text-red-500">{errors.uri}</p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {t(
                  "settings.libraries.localPathHint",
                  "Absolute path to the folder on this device",
                )}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="lib-address">{addressLabel}</Label>
              <Input
                id="lib-address"
                value={form.uri}
                onChange={(e) => setForm({ ...form, uri: e.target.value })}
                onBlur={() => handleFieldBlur("uri")}
                placeholder={addressPlaceholder}
                className={fieldClass("uri")}
              />
              {errors.uri && (
                <p className="mt-1 text-xs text-red-500">{errors.uri}</p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {addressHint}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="lib-folder">
              {t("settings.libraries.folderName", "Folder Name")}
            </Label>
            <Input
              id="lib-folder"
              value={form.mount_path}
              onChange={(e) => {
                setAutoSlug(false);
                setForm({ ...form, mount_path: e.target.value });
              }}
              onBlur={() => handleFieldBlur("mount_path")}
              placeholder={t(
                "settings.libraries.folderNamePlaceholder",
                "my-music",
              )}
              className={fieldClass("mount_path")}
            />
            {errors.mount_path && (
              <p className="mt-1 text-xs text-red-500">{errors.mount_path}</p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {t(
                "settings.libraries.folderNameHint",
                "Subfolder under /opt/sonect/music",
              )}
            </p>
          </div>

          {sourceType === "smb" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="lib-user">
                  {t("settings.libraries.username", "Username")}
                </Label>
                <Input
                  id="lib-user"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  placeholder={t(
                    "settings.libraries.usernamePlaceholder",
                    "Optional",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lib-pass">
                  {t("settings.libraries.password", "Password")}
                </Label>
                <Input
                  id="lib-pass"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder={
                    editingId
                      ? t(
                          "settings.libraries.passwordEditPlaceholder",
                          "Leave empty to keep current",
                        )
                      : t("settings.libraries.passwordPlaceholder", "Optional")
                  }
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          {!editingId && (
            <Button variant="outline" onClick={onBack}>
              {t("settings.libraries.back", "Back")}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingId
              ? t("settings.libraries.save", "Save")
              : t("settings.libraries.create", "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
