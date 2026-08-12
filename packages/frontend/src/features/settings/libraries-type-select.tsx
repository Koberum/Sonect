import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LibrarySourcePicker, type SourceType } from "./library-source-picker";

export type { SourceType };

interface LibrariesTypeSelectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: SourceType) => void;
}

export function LibrariesTypeSelect({
  open,
  onOpenChange,
  onSelect,
}: LibrariesTypeSelectProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("settings.libraries.selectType", "Select Source Type")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "settings.libraries.selectTypeDesc",
              "Choose the type of source you want to add.",
            )}
          </DialogDescription>
        </DialogHeader>
        <LibrarySourcePicker onSelect={onSelect} />
      </DialogContent>
    </Dialog>
  );
}
