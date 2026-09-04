import { useState } from "react";
import type { StorageSource } from "@/features/apis/systemApis";
import type { SourceType } from "./library-source-picker";

export interface LibrarySourceFormValues {
  name: string;
  type: SourceType;
  uri: string;
  username?: string;
  password?: string;
}

interface UseLibrarySourceFormOptions {
  sourceType: SourceType;
  initialValues?: StorageSource;
  onSave: (data: LibrarySourceFormValues) => Promise<void>;
}

export function useLibrarySourceForm({
  sourceType,
  initialValues,
  onSave,
}: UseLibrarySourceFormOptions) {
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
