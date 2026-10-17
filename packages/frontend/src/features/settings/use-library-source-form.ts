import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { StorageSource } from "@/features/system/api";

export interface LibrarySourceFormValues {
  name: string;
  path: string;
}

interface UseLibrarySourceFormOptions {
  initialValues?: StorageSource;
  onSave: (data: LibrarySourceFormValues) => Promise<void>;
}

export function useLibrarySourceForm({
  initialValues,
  onSave,
}: UseLibrarySourceFormOptions) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    path: initialValues?.path ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const requiredMessage = t("settings.libraries.required", "Required");

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = requiredMessage;
    if (!form.path.trim()) errs.path = requiredMessage;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFieldBlur = (field: string) => {
    setErrors((prev) => {
      const val = form[field as keyof typeof form];
      if (typeof val === "string" && !val.trim()) {
        return { ...prev, [field]: requiredMessage };
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const fieldClass = (field: string) =>
    errors[field]
      ? "border-destructive focus-visible:ring-destructive focus-visible:border-destructive"
      : "";

  const submit = () => {
    if (!validate()) return;
    setSaving(true);

    onSave(form)
      .catch(() => undefined)
      .finally(() => setSaving(false));
  };

  return {
    form,
    setForm,
    errors,
    saving,
    validate,
    handleFieldBlur,
    fieldClass,
    submit,
  };
}
