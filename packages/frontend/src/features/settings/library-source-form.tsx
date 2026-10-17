import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  formId?: string;
  onSubmit?: () => void;
}

export function LibrarySourceForm({
  form,
  setForm,
  errors,
  handleFieldBlur,
  fieldClass,
  formId = "library-source-form",
  onSubmit,
}: LibrarySourceFormProps) {
  const { t } = useTranslation();

  return (
    <form
      id={formId}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>
          {t("settings.libraries.name", "Name")}
        </Label>
        <Input
          id={`${formId}-name`}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onBlur={() => handleFieldBlur("name")}
          placeholder={t("settings.libraries.namePlaceholder", "My Music")}
          className={fieldClass("name")}
        />
        {errors.name && (
          <p className="text-destructive mt-1 text-xs">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-path`}>
          {t("settings.libraries.path", "Folder Path")}
        </Label>
        <Input
          id={`${formId}-path`}
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
          <p className="text-destructive mt-1 text-xs">{errors.path}</p>
        )}
        <p className="text-muted-foreground mt-1 text-xs">
          {t(
            "settings.libraries.pathHint",
            "Folder inside the container, under the music directory. Add it as a bind mount on the host.",
          )}
        </p>
      </div>
    </form>
  );
}
