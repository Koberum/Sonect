import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  useLibrarySourceForm,
  type LibrarySourceFormValues,
} from "./use-library-source-form";

export type { LibrarySourceFormValues };

type LibrarySourceFormState = ReturnType<typeof useLibrarySourceForm>;

interface LibrarySourceFormProps {
  formState: LibrarySourceFormState;
  formId?: string;
  onSubmit?: () => void;
}

export function LibrarySourceForm({
  formState,
  formId = "library-source-form",
  onSubmit,
}: LibrarySourceFormProps) {
  const { t } = useTranslation();
  const { form, setForm, errors, handleFieldBlur } = formState;

  return (
    <form
      id={formId}
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor={`${formId}-name`}>
            {t("settings.libraries.name", "Name")}
          </FieldLabel>
          <Input
            id={`${formId}-name`}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => handleFieldBlur("name")}
            aria-invalid={!!errors.name}
            placeholder={t("settings.libraries.namePlaceholder", "My Music")}
          />
          <FieldError>{errors.name}</FieldError>
        </Field>

        <Field data-invalid={!!errors.path}>
          <FieldLabel htmlFor={`${formId}-path`}>
            {t("settings.libraries.path", "Folder Path")}
          </FieldLabel>
          <Input
            id={`${formId}-path`}
            value={form.path}
            onChange={(e) => setForm({ ...form, path: e.target.value })}
            onBlur={() => handleFieldBlur("path")}
            aria-invalid={!!errors.path}
            placeholder={t(
              "settings.libraries.pathPlaceholder",
              "/libraries/music",
            )}
          />
          <FieldDescription>
            {t(
              "settings.libraries.pathHint",
              "Folder inside the container, under the music directory. Add it as a bind mount on the host.",
            )}
          </FieldDescription>
          <FieldError>{errors.path}</FieldError>
        </Field>
      </FieldGroup>
    </form>
  );
}
