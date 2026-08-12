import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createStorageSource,
  mountStorageSource,
} from "@/features/apis/systemApis";
import {
  LibrarySourcePicker,
  type SourceType,
} from "@/features/settings/library-source-picker";
import { LibrarySourceForm } from "@/features/settings/library-source-form";

interface StorageStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function StorageStep({ onNext, onSkip }: StorageStepProps) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<SourceType | null>(null);

  const handleSave = async (data: {
    name: string;
    type: SourceType;
    uri: string;
    mount_path: string;
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
      onNext();
    } catch {
      toast.error(
        t("settings.storage.createError", "Failed to create storage source"),
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold">
          {t("settings.storage.title", "Storage")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t(
            "setup.storage.description",
            "Add a network or local source for your music library.",
          )}
        </p>
      </div>

      {selectedType === null ? (
        <>
          <div className="text-muted-foreground space-y-3 text-sm">
            <p>
              {t(
                "setup.storage.info",
                "You can add SMB/CIFS, NFS, or local storage sources. Skip this step to configure storage later in Settings.",
              )}
            </p>
          </div>
          <LibrarySourcePicker onSelect={setSelectedType} />
          <div className="flex justify-between pt-2">
            <Button variant="ghost" type="button" onClick={onSkip}>
              {t("common.skip", "Skip")}
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold">
              {t("settings.libraries.addSource", "Add Library")}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {t(
                "settings.libraries.formDescription",
                "Fill in the details for your library source.",
              )}
            </p>
          </div>
          <LibrarySourceForm
            key={selectedType}
            sourceType={selectedType}
            onSave={handleSave}
            renderFooter={({ saving, submit }) => (
              <div className="flex items-center justify-between pt-2">
                <Button variant="ghost" type="button" onClick={onSkip}>
                  {t("common.skip", "Skip")}
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={() => setSelectedType(null)}
                  >
                    {t("setup.storage.backToTypes", "Back to types")}
                  </Button>
                  <Button type="button" onClick={submit} disabled={saving}>
                    {saving
                      ? t("setup.storage.creating", "Creating...")
                      : t("setup.storage.addSourceSubmit", "Create & Continue")}
                  </Button>
                </div>
              </div>
            )}
          />
        </div>
      )}
    </div>
  );
}
