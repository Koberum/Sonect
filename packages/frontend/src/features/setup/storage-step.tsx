import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createStorageSource, type StorageSource } from "@/features/system/api";
import {
  LibrarySourceForm,
  type LibrarySourceFormValues,
} from "@/features/settings/library-source-form";
import { LibraryStats } from "@/features/settings/library-stats";
import { useLibrarySourceForm } from "@/features/settings/use-library-source-form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  WizardStep,
  WizardStepActions,
  WizardStepContent,
  WizardStepDescription,
  WizardStepHeader,
  WizardStepTitle,
} from "@/components/ui/wizard-step";

interface StorageStepProps {
  onNext: () => void;
  onBack?: () => void;
}

export function StorageStep({ onNext, onBack }: StorageStepProps) {
  const { t } = useTranslation();
  const [createdSource, setCreatedSource] = useState<StorageSource | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleSave = async (data: LibrarySourceFormValues) => {
    try {
      const source = await createStorageSource(data);
      setCreatedSource(source);
      setConfirmOpen(true);
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.storage.createError", "Failed to create storage source"),
      );
    }
  };

  const form = useLibrarySourceForm({ onSave: handleSave });

  return (
    <WizardStep>
      <WizardStepHeader>
        <WizardStepTitle>
          {t("settings.storage.title", "Storage")}
        </WizardStepTitle>
        <WizardStepDescription>
          {t(
            "setup.storage.description",
            "Register a folder that is bind-mounted into the container.",
          )}
        </WizardStepDescription>
      </WizardStepHeader>
      <WizardStepContent>
        <LibrarySourceForm
          form={form.form}
          setForm={form.setForm}
          errors={form.errors}
          handleFieldBlur={form.handleFieldBlur}
          fieldClass={form.fieldClass}
          detected={form.detected}
          applyDetected={form.applyDetected}
        />
      </WizardStepContent>
      <WizardStepActions>
        {onBack && (
          <Button variant="outline" type="button" onClick={onBack}>
            {t("setup.wizard.back", "Back")}
          </Button>
        )}
        <Button type="button" onClick={form.submit} disabled={form.saving}>
          {form.saving
            ? t("setup.storage.creating", "Creating...")
            : t("setup.storage.addSourceSubmit", "Create & Continue")}
        </Button>
      </WizardStepActions>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) {
            setCreatedSource(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("setup.storage.confirmTitle", "Library added")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "setup.storage.confirmDescription",
                "We validated the folder and scanned your music files.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {createdSource && (
            <div className="space-y-2 text-sm">
              <div className="font-medium">{createdSource.name}</div>
              <div className="text-muted-foreground font-mono text-xs break-all">
                {createdSource.path}
              </div>
              <LibraryStats stats={createdSource} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmOpen(false);
                setCreatedSource(null);
              }}
            >
              {t("setup.storage.confirmCancel", "Back")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                setCreatedSource(null);
                onNext();
              }}
            >
              {t("setup.storage.confirmContinue", "Continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WizardStep>
  );
}
