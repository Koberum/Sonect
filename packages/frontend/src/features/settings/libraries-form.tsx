import { useTranslation } from "react-i18next";
import { Folder, HardDrive, Loader2, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StorageSource } from "@/features/apis/systemApis";
import { LibrarySourceForm } from "./library-source-form";
import type { SourceType } from "./library-source-picker";

interface LibrariesFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: {
    name: string;
    type: SourceType;
    uri: string;
    username?: string;
    password?: string;
  }) => Promise<void>;
  onBack: () => void;
  sourceType: SourceType;
  initialValues?: StorageSource;
  editingId?: number | null;
}

const typeIcons: Record<SourceType, typeof Server> = {
  smb: Server,
  nfs: HardDrive,
  local: Folder,
};

const typeBadgeLabels: Record<SourceType, string> = {
  smb: "SMB",
  nfs: "NFS",
  local: "Local",
};

export function LibrariesForm({
  open,
  onOpenChange,
  onSave,
  onBack,
  sourceType,
  initialValues,
  editingId,
}: LibrariesFormProps) {
  const { t } = useTranslation();
  const TypeIcon = typeIcons[sourceType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editingId
              ? t("settings.libraries.edit", "Edit Library")
              : t("settings.libraries.addSource", "Add Library")}
            <Badge variant="secondary" className="gap-1">
              <TypeIcon className="h-3 w-3" />
              {typeBadgeLabels[sourceType]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {t(
              "settings.libraries.formDescription",
              "Fill in the details for your library source.",
            )}
          </DialogDescription>
        </DialogHeader>
        <LibrarySourceForm
          sourceType={sourceType}
          initialValues={initialValues}
          editingId={editingId}
          onSave={onSave}
          renderFooter={({ saving, submit }) => (
            <DialogFooter>
              {!editingId && (
                <Button variant="outline" onClick={onBack}>
                  {t("settings.libraries.back", "Back")}
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="button" onClick={submit} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId
                  ? t("settings.libraries.save", "Save")
                  : t("settings.libraries.create", "Create")}
              </Button>
            </DialogFooter>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
