import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { DetectedLibrary, StorageSource } from "@/features/system/api";
import { systemQueries, systemMutations } from "@/features/system/queries";
import { DetectedLibraryRow } from "@/features/settings/library-rows";
import { LibraryStats } from "@/features/settings/library-stats";
import {
  LibrarySourceForm,
  type LibrarySourceFormValues,
} from "@/features/settings/library-source-form";
import { useLibrarySourceForm } from "@/features/settings/use-library-source-form";
import {
  AlertDialog,
  AlertDialogAction,
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

const FORM_ID = "wizard-library-form";

export function StorageStep({ onNext, onBack }: StorageStepProps) {
  const { t } = useTranslation();
  const [createdSource, setCreatedSource] = useState<StorageSource | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sourcesQuery = useQuery(systemQueries.storageSources());
  const detectedQuery = useQuery(systemQueries.detectedLibraries());
  const createMut = useMutation(systemMutations.createStorageSource());
  const computeMut = useMutation(systemMutations.computeStorageStats());

  const hasSources = (sourcesQuery.data ?? []).length > 0;
  const detected = (detectedQuery.data ?? []).filter((l) => !l.registered);

  const showSuccess = (source: StorageSource) => {
    setCreatedSource(source);
    setConfirmOpen(true);
  };

  const handleManualSave = async (data: LibrarySourceFormValues) => {
    try {
      const source = await createMut.mutateAsync(data);
      showSuccess(source);
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.storage.createError", "Failed to create storage source"),
      );
    }
  };

  const handleAddDetected = async (lib: DetectedLibrary) => {
    try {
      const source = await createMut.mutateAsync({
        name: lib.name,
        path: lib.path,
      });
      showSuccess(source);
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.storage.createError", "Failed to create storage source"),
      );
    }
  };

  const handleComputeStats = async (lib: DetectedLibrary) => {
    try {
      await computeMut.mutateAsync(lib.path);
      toast.success(t("settings.libraries.statsRefreshed", "Stats updated"));
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.libraries.refreshStatsError", "Failed to refresh stats"),
      );
    }
  };

  const form = useLibrarySourceForm({ onSave: handleManualSave });

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
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {t("settings.libraries.detected", "Detected libraries")}
          </p>
          {detectedQuery.isPending ? (
            <p className="text-muted-foreground text-sm">
              {t("common.loading", "Loading...")}
            </p>
          ) : detected.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t(
                "settings.libraries.noDetected",
                "No folders detected under the music directory.",
              )}
            </p>
          ) : (
            <div className="space-y-2">
              {detected.map((lib) => (
                <DetectedLibraryRow
                  key={lib.path}
                  lib={lib}
                  isAdding={
                    createMut.isPending &&
                    createMut.variables?.path === lib.path
                  }
                  isComputing={
                    computeMut.isPending && computeMut.variables === lib.path
                  }
                  onAdd={() => handleAddDetected(lib)}
                  onCompute={() => handleComputeStats(lib)}
                />
              ))}
            </div>
          )}
        </div>

        <p className="text-muted-foreground pt-2 text-sm font-medium">
          {t("setup.storage.addManually", "Or add manually")}
        </p>

        <LibrarySourceForm
          form={form.form}
          setForm={form.setForm}
          errors={form.errors}
          handleFieldBlur={form.handleFieldBlur}
          fieldClass={form.fieldClass}
          formId={FORM_ID}
          onSubmit={form.submit}
        />
      </WizardStepContent>
      <WizardStepActions>
        {onBack && (
          <Button variant="outline" type="button" onClick={onBack}>
            {t("setup.wizard.back", "Back")}
          </Button>
        )}
        {hasSources && (
          <Button variant="outline" type="button" onClick={onNext}>
            {t("common.continue", "Continue")}
          </Button>
        )}
        <Button type="submit" form={FORM_ID} disabled={form.saving}>
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
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                setCreatedSource(null);
                onNext();
              }}
            >
              {t("common.continue", "Continue")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WizardStep>
  );
}
