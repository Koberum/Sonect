import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StorageSource } from "@/features/apis/systemApis";
import type { SourceType } from "./library-source-picker";

export interface LibrarySourceFormValues {
  name: string;
  type: SourceType;
  uri: string;
  username?: string;
  password?: string;
}

interface LibrarySourceFormProps {
  sourceType: SourceType;
  initialValues?: StorageSource;
  editingId?: number | null;
  onSave: (data: LibrarySourceFormValues) => Promise<void>;
  renderFooter: (helpers: { saving: boolean; submit: () => void }) => ReactNode;
}

export function LibrarySourceForm({
  sourceType,
  initialValues,
  editingId,
  onSave,
  renderFooter,
}: LibrarySourceFormProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    uri: initialValues?.uri ?? "",
    username: initialValues?.username ?? "",
    password: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!form.uri.trim()) errs.uri = "Required";
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

  const submit = () => {
    if (!validate()) return;
    setSaving(true);
    const payload: LibrarySourceFormValues = {
      ...form,
      type: sourceType,
    };

    onSave(payload)
      .catch(() => undefined)
      .finally(() => setSaving(false));
  };

  return (
    <div>
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
            <p className="text-muted-foreground mt-1 text-xs">{addressHint}</p>
          </div>
        )}

        {sourceType === "smb" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="lib-user">
                {t("settings.libraries.username", "Username")}
              </Label>
              <Input
                id="lib-user"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
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
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
      {renderFooter({ saving, submit })}
    </div>
  );
}
