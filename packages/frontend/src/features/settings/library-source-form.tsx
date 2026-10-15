import { useTranslation } from "react-i18next";
import { HardDrive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  SelectableRow,
  SelectableRowIcon,
  SelectableRowTitle,
  SelectableRowDescription,
} from "@/components/ui/selectable-row";
import type { DetectedLibrary } from "@/features/system/api";
import {
  useLibrarySourceForm,
  type LibrarySourceFormValues,
} from "./use-library-source-form";

export type { LibrarySourceFormValues };

type LibrarySourceFormState = ReturnType<typeof useLibrarySourceForm>;

interface LibrarySourceFormProps {
  editingId?: number | null;
  form: LibrarySourceFormState["form"];
  setForm: LibrarySourceFormState["setForm"];
  errors: LibrarySourceFormState["errors"];
  handleFieldBlur: LibrarySourceFormState["handleFieldBlur"];
  fieldClass: LibrarySourceFormState["fieldClass"];
  detected?: DetectedLibrary[];
  applyDetected?: (lib: DetectedLibrary) => void;
}

export function LibrarySourceForm({
  form,
  setForm,
  errors,
  handleFieldBlur,
  fieldClass,
  detected = [],
  applyDetected,
}: LibrarySourceFormProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {detected.length > 0 && (
        <div className="space-y-2">
          <Label>
            {t("settings.libraries.detected", "Detected libraries")}
          </Label>
          <div className="space-y-2">
            {detected.map((lib) => {
              const disabled = lib.registered;
              return (
                <SelectableRow
                  key={lib.path}
                  asChild
                  className={disabled ? "cursor-not-allowed opacity-60" : ""}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => applyDetected?.(lib)}
                    className="w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <SelectableRowIcon>
                      <HardDrive className="h-4 w-4" />
                    </SelectableRowIcon>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SelectableRowTitle className="truncate">
                          {lib.name}
                        </SelectableRowTitle>
                        {lib.isMount && (
                          <Badge variant="secondary" className="shrink-0">
                            {t("settings.libraries.isMount", "Mount")}
                          </Badge>
                        )}
                        {lib.registered && (
                          <Badge variant="outline" className="shrink-0">
                            {t(
                              "settings.libraries.alreadyAdded",
                              "Already added",
                            )}
                          </Badge>
                        )}
                      </div>
                      <SelectableRowDescription className="truncate font-mono text-xs">
                        {lib.path}
                      </SelectableRowDescription>
                    </div>
                  </button>
                </SelectableRow>
              );
            })}
          </div>
        </div>
      )}

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

      <div className="space-y-2">
        <Label htmlFor="lib-path">
          {t("settings.libraries.path", "Folder Path")}
        </Label>
        <Input
          id="lib-path"
          value={form.path}
          onChange={(e) => setForm({ ...form, path: e.target.value })}
          onBlur={() => handleFieldBlur("path")}
          placeholder={t(
            "settings.libraries.pathPlaceholder",
            "/libraries/music",
          )}
          className={fieldClass("path")}
        />
        {errors.path && (
          <p className="mt-1 text-xs text-red-500">{errors.path}</p>
        )}
        <p className="text-muted-foreground mt-1 text-xs">
          {t(
            "settings.libraries.pathHint",
            "Folder inside the container, under the music directory. Add it as a bind mount on the host.",
          )}
        </p>
      </div>
    </div>
  );
}
