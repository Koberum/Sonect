import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceType } from "./library-source-picker";
import {
  useLibrarySourceForm,
  type LibrarySourceFormValues,
} from "./use-library-source-form";

export type { LibrarySourceFormValues };

type LibrarySourceFormState = ReturnType<typeof useLibrarySourceForm>;

interface LibrarySourceFormProps {
  sourceType: SourceType;
  editingId?: number | null;
  form: LibrarySourceFormState["form"];
  setForm: LibrarySourceFormState["setForm"];
  errors: LibrarySourceFormState["errors"];
  handleFieldBlur: LibrarySourceFormState["handleFieldBlur"];
  fieldClass: LibrarySourceFormState["fieldClass"];
}

export function LibrarySourceForm({
  sourceType,
  editingId,
  form,
  setForm,
  errors,
  handleFieldBlur,
  fieldClass,
}: LibrarySourceFormProps) {
  const { t } = useTranslation();

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
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="lib-name">{t("settings.libraries.name", "Name")}</Label>
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
  );
}
