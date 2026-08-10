import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StorageSource } from "@/features/apis/systemApis";

interface StorageSourceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    type: "smb" | "nfs" | "local";
    uri: string;
    mount_path: string;
    username?: string;
    password?: string;
  }) => Promise<void>;
  initialValues?: StorageSource;
  editingId?: number | null;
}

export function StorageSourceForm({
  open,
  onOpenChange,
  onSave,
  initialValues,
  editingId,
}: StorageSourceFormProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    type: (initialValues?.type ?? "smb") as "smb" | "nfs" | "local",
    uri: initialValues?.uri ?? "",
    mount_path:
      initialValues?.mount_path.replace(/^\/opt\/sonect\/music\/?/, "") ?? "",
    username: initialValues?.username ?? "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const typeLabels = {
    smb: t("settings.storage.typeSmb", "SMB / CIFS"),
    nfs: t("settings.storage.typeNfs", "NFS"),
    local: t("settings.storage.typeLocal", "Local"),
  } as const;

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
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (field: string) =>
    errors[field] ? "border-red-500 focus-visible:ring-red-500" : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingId
              ? t("settings.storage.edit", "Edit Storage Source")
              : t("settings.storage.addSource", "Add Storage Source")}
          </DialogTitle>
          <DialogDescription>
            {t("settings.storage.description", "Manage SMB/NFS music sources.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="src-name">
              {t("settings.storage.name", "Name")}
            </Label>
            <Input
              id="src-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={() => handleFieldBlur("name")}
              placeholder={t("settings.storage.namePlaceholder", "My NAS")}
              className={fieldClass("name")}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-500">{errors.name}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="src-type">
              {t("settings.storage.type", "Type")}
            </Label>
            <Select
              value={form.type}
              onValueChange={(v) =>
                setForm({ ...form, type: v as "smb" | "nfs" | "local" })
              }
            >
              <SelectTrigger id="src-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smb">{typeLabels.smb}</SelectItem>
                <SelectItem value="nfs">{typeLabels.nfs}</SelectItem>
                <SelectItem value="local">{typeLabels.local}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="src-uri">{t("settings.storage.uri", "URI")}</Label>
            <Input
              id="src-uri"
              value={form.uri}
              onChange={(e) => setForm({ ...form, uri: e.target.value })}
              onBlur={() => handleFieldBlur("uri")}
              placeholder={t(
                "settings.storage.uriPlaceholder",
                "smb://server/share",
              )}
              className={fieldClass("uri")}
            />
            {errors.uri && (
              <p className="mt-1 text-xs text-red-500">{errors.uri}</p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {t(
                "settings.storage.uriHint",
                "Use //server/share format without credentials",
              )}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="src-path">
              {t("settings.storage.mountPath", "Mount Path")}
            </Label>
            <Input
              id="src-path"
              value={form.mount_path}
              onChange={(e) => setForm({ ...form, mount_path: e.target.value })}
              onBlur={() => handleFieldBlur("mount_path")}
              placeholder={t("settings.storage.mountPathPlaceholder", "NAS")}
              className={fieldClass("mount_path")}
            />
            {errors.mount_path && (
              <p className="mt-1 text-xs text-red-500">{errors.mount_path}</p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {t(
                "settings.storage.mountPathHint",
                "Subpath under /opt/sonect/music",
              )}
            </p>
          </div>
          {form.type === "smb" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="src-user">
                  {t("settings.storage.username", "Username")}
                </Label>
                <Input
                  id="src-user"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                  placeholder={t(
                    "settings.storage.usernamePlaceholder",
                    "Optional",
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="src-pass">
                  {t("settings.storage.password", "Password")}
                </Label>
                <Input
                  id="src-pass"
                  type="password"
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder={
                    editingId
                      ? t(
                          "settings.storage.passwordEditPlaceholder",
                          "Leave empty to keep current",
                        )
                      : t("settings.storage.passwordPlaceholder", "Optional")
                  }
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingId
              ? t("settings.storage.save", "Save")
              : t("settings.storage.create", "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
