import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { systemQueries } from "@/features/system/queries";
import type { DetectedLibrary, StorageSource } from "@/features/system/api";

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
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initialValues?.name ?? "",
    path: initialValues?.path ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: detected = [] } = useQuery(systemQueries.detectedLibraries());

  const applyDetected = (lib: DetectedLibrary) => {
    setForm({ name: lib.name, path: lib.path });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.name;
      delete next.path;
      return next;
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!form.path.trim()) errs.path = "Required";
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
    detected,
    applyDetected,
  };
}
