import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StorageSource } from "@/features/system/api";
import {
  LibrarySourceForm,
  type LibrarySourceFormValues,
} from "./library-source-form";
import { useLibrarySourceForm } from "./use-library-source-form";

interface LibrariesFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: LibrarySourceFormValues) => Promise<void>;
  initialValues?: StorageSource;
  editingId?: number | null;
}

function LibrariesFormFields({
  initialValues,
  editingId,
  onSave,
  onClose,
}: {
  initialValues?: StorageSource;
  editingId?: number | null;
  onSave: (data: LibrarySourceFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const form = useLibrarySourceForm({ initialValues, onSave });

  return (
    <>
      <LibrarySourceForm
        editingId={editingId}
        form={form.form}
        setForm={form.setForm}
        errors={form.errors}
        handleFieldBlur={form.handleFieldBlur}
        fieldClass={form.fieldClass}
        detected={form.detected}
        applyDetected={form.applyDetected}
      />
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button type="button" onClick={form.submit} disabled={form.saving}>
          {form.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {editingId
            ? t("settings.libraries.save", "Save")
            : t("settings.libraries.create", "Create")}
        </Button>
      </DialogFooter>
    </>
  );
}

export function LibrariesForm({
  open,
  onOpenChange,
  onSave,
  initialValues,
  editingId,
}: LibrariesFormProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingId
              ? t("settings.libraries.edit", "Edit Library")
              : t("settings.libraries.addSource", "Add Library")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "settings.libraries.formDescription",
              "Register a folder that is bind-mounted into the container.",
            )}
          </DialogDescription>
        </DialogHeader>
        <LibrariesFormFields
          initialValues={initialValues}
          editingId={editingId}
          onSave={onSave}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
