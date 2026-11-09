import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import type { DetectedLibrary, StorageSource } from "@/features/system/api";
import { DetectedLibrariesList } from "@/features/settings/detected-libraries-list";
import { LibraryStats } from "@/features/settings/library-stats";
import {
  LibrarySourceForm,
  type LibrarySourceFormValues,
} from "@/features/settings/library-source-form";
import { useLibraries } from "@/features/settings/use-libraries";
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
  const { sources, detected, detectedQuery, createMut, computeMut } =
    useLibraries();

  const hasSources = sources.length > 0;

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

  const handleAddDetected = async (library: DetectedLibrary) => {
    try {
      const source = await createMut.mutateAsync({
        name: library.name,
        path: library.path,
      });
      showSuccess(source);
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.storage.createError", "Failed to create storage source"),
      );
    }
  };

  const handleComputeStats = async (library: DetectedLibrary) => {
    try {
      await computeMut.mutateAsync(library.path);
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
      <WizardStepContent className="flex flex-col gap-4 text-left">
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            {t("settings.libraries.detected", "Detected libraries")}
          </h2>
          <DetectedLibrariesList
            libraries={detected}
            isPending={detectedQuery.isPending}
            isError={detectedQuery.isError}
            onRetry={() => void detectedQuery.refetch()}
            isAdding={(library) =>
              createMut.isPending && createMut.variables?.path === library.path
            }
            isComputing={(library) =>
              computeMut.isPending && computeMut.variables === library.path
            }
            onAdd={(library) => void handleAddDetected(library)}
            onCompute={(library) => void handleComputeStats(library)}
          />
        </section>

        <Separator />

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            {t("setup.storage.addManually", "Or add manually")}
          </h2>

          <LibrarySourceForm
            formState={form}
            formId={FORM_ID}
            onSubmit={form.submit}
          />
        </section>
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
            <div className="flex flex-col gap-2 text-sm">
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
