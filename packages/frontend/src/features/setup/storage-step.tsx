import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createStorageSource,
  mountStorageSource,
  type StorageSource,
} from "@/features/apis/systemApis";
import {
  LibrarySourcePicker,
  type SourceType,
} from "@/features/settings/library-source-picker";
import {
  LibrarySourceForm,
  type LibrarySourceFormValues,
} from "@/features/settings/library-source-form";
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

interface StorageSourceFormPanelProps {
  sourceType: SourceType;
  onSave: (data: LibrarySourceFormValues) => Promise<void>;
  onBack: () => void;
}

function StorageSourceFormPanel({
  sourceType,
  onSave,
  onBack,
}: StorageSourceFormPanelProps) {
  const { t } = useTranslation();
  const form = useLibrarySourceForm({ sourceType, onSave });

  return (
    <>
      <WizardStepHeader>
        <WizardStepTitle>
          {t("settings.libraries.addSource", "Add Library")}
        </WizardStepTitle>
        <WizardStepDescription>
          {t(
            "settings.libraries.formDescription",
            "Fill in the details for your library source.",
          )}
        </WizardStepDescription>
      </WizardStepHeader>
      <WizardStepContent>
        <LibrarySourceForm
          sourceType={sourceType}
          form={form.form}
          setForm={form.setForm}
          errors={form.errors}
          handleFieldBlur={form.handleFieldBlur}
          fieldClass={form.fieldClass}
        />
      </WizardStepContent>
      <WizardStepActions>
        <Button variant="outline" type="button" onClick={onBack}>
          {t("setup.wizard.back", "Back")}
        </Button>
        <Button type="button" onClick={form.submit} disabled={form.saving}>
          {form.saving
            ? t("setup.storage.creating", "Creating...")
            : t("setup.storage.addSourceSubmit", "Create & Continue")}
        </Button>
      </WizardStepActions>
    </>
  );
}

export function StorageStep({ onNext, onBack }: StorageStepProps) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<SourceType | null>(null);
  const [createdSource, setCreatedSource] = useState<StorageSource | null>(
    null,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const formatCount = (n: number | undefined): string =>
    (n ?? 0).toLocaleString();

  function formatBytes(bytes?: number): string {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024)),
    );
    const value = bytes / 1024 ** i;
    return `${value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1)} ${
      units[i]
    }`;
  }

  const handleSave = async (data: {
    name: string;
    type: SourceType;
    uri: string;
    username?: string;
    password?: string;
  }) => {
    try {
      const source = await createStorageSource(data);
      const result = await mountStorageSource(source.id);
      if (result.success) {
        toast.success(t("settings.storage.mounted", "Mounted"));
      } else {
        toast.error(
          result.error ?? t("settings.storage.mountError", "Mount failed"),
        );
      }
      setCreatedSource(source);
      setConfirmOpen(true);
    } catch (err) {
      toast.error(
        (err instanceof Error && err.message) ||
          t("settings.storage.createError", "Failed to create storage source"),
      );
    }
  };

  return (
    <WizardStep>
      {selectedType === null ? (
        <>
          <WizardStepHeader>
            <WizardStepTitle>
              {t("settings.storage.title", "Storage")}
            </WizardStepTitle>
            <WizardStepDescription>
              {t(
                "setup.storage.description",
                "Add a network or local source for your music library.",
              )}
            </WizardStepDescription>
          </WizardStepHeader>
          <WizardStepContent>
            <LibrarySourcePicker onSelect={setSelectedType} />
          </WizardStepContent>
          <WizardStepActions>
            <Button variant="outline" type="button" onClick={onBack}>
              {t("setup.wizard.back", "Back")}
            </Button>
          </WizardStepActions>
        </>
      ) : (
        <StorageSourceFormPanel
          key={selectedType}
          sourceType={selectedType}
          onSave={handleSave}
          onBack={() => setSelectedType(null)}
        />
      )}

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
              <div className="text-muted-foreground text-xs break-all">
                {createdSource.uri}
              </div>
              <div className="text-muted-foreground text-xs">
                {t("settings.libraries.stats", {
                  files: formatCount(createdSource.file_count),
                  folders: formatCount(createdSource.dir_count),
                  size: formatBytes(createdSource.total_size),
                })}
              </div>
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
