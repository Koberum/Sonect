import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createStorageSource,
  mountStorageSource,
} from "@/features/apis/systemApis";

interface StorageStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function StorageStep({ onNext, onSkip }: StorageStepProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);

  const handleSave = async (data: {
    name: string;
    type: "smb" | "nfs" | "local";
    uri: string;
    mount_path: string;
    username?: string;
    password?: string;
  }) => {
    setSaving(true);
    try {
      const source = await createStorageSource(data);
      const result = await mountStorageSource(source.id);
      if (result.success) {
        toast.success(t("settings.storage.mounted", "Mounted"));
      } else {
        toast.error(
          result.error ?? t("settings.storage.mountError", "Mount failed"),
        );
      }
      onNext();
    } catch {
      toast.error(
        t("settings.storage.createError", "Failed to create storage source"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">
          {t("settings.storage.title", "Storage")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t(
            "setup.storage.description",
            "Add a network or local source for your music library.",
          )}
        </p>
      </div>

      <div className="text-muted-foreground space-y-3 text-sm">
        <p>
          {t(
            "setup.storage.info",
            "You can add SMB/CIFS, NFS, or local storage sources. Skip this step to configure storage later in Settings.",
          )}
        </p>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          handleSave({
            name: data.get("name") as string,
            type: (data.get("type") || "smb") as "smb" | "nfs" | "local",
            uri: data.get("uri") as string,
            mount_path: data.get("mount_path") as string,
            username: (data.get("username") as string) || undefined,
            password: (data.get("password") as string) || undefined,
          });
        }}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t("settings.storage.name", "Name")}
          </label>
          <input
            name="name"
            required
            className="bg-background file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            placeholder={t("settings.storage.namePlaceholder", "My NAS")}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t("settings.storage.type", "Type")}
          </label>
          <select
            name="type"
            className="bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          >
            <option value="smb">
              {t("settings.storage.typeSmb", "SMB / CIFS")}
            </option>
            <option value="nfs">{t("settings.storage.typeNfs", "NFS")}</option>
            <option value="local">
              {t("settings.storage.typeLocal", "Local")}
            </option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t("settings.storage.uri", "URI")}
          </label>
          <input
            name="uri"
            required
            className="bg-background file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            placeholder={t("settings.storage.uriPlaceholder", "//server/share")}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {t("settings.storage.mountPath", "Mount Path")}
          </label>
          <input
            name="mount_path"
            required
            className="bg-background file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            placeholder={t("settings.storage.mountPathPlaceholder", "NAS")}
          />
          <p className="text-muted-foreground text-xs">
            {t(
              "settings.storage.mountPathHint",
              "Subpath under /opt/sonect/music",
            )}
          </p>
        </div>

        <div className="flex justify-between pt-2">
          <Button type="button" variant="ghost" onClick={onSkip}>
            {t("common.skip", "Skip")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving
              ? t("settings.storage.creating", "Creating...")
              : t("setup.storage.addAndContinue", "Add & Continue")}
          </Button>
        </div>
      </form>
    </div>
  );
}
