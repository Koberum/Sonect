import { useTranslation } from "react-i18next";
import { Folder, HardDrive, Server } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SourceType = "smb" | "nfs" | "local";

interface LibrariesTypeSelectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: SourceType) => void;
}

const typeConfig: {
  value: SourceType;
  icon: typeof Server;
  titleKey: string;
  descKey: string;
}[] = [
  {
    value: "smb",
    icon: Server,
    titleKey: "settings.libraries.typeSmb",
    descKey: "settings.libraries.typeSmbDesc",
  },
  {
    value: "nfs",
    icon: HardDrive,
    titleKey: "settings.libraries.typeNfs",
    descKey: "settings.libraries.typeNfsDesc",
  },
  {
    value: "local",
    icon: Folder,
    titleKey: "settings.libraries.typeLocal",
    descKey: "settings.libraries.typeLocalDesc",
  },
];

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
        <div className="grid gap-3">
          {typeConfig.map(({ value, icon: Icon, titleKey, descKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              className="hover:bg-accent flex items-center gap-4 rounded-lg border p-4 text-left transition-colors"
            >
              <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                <Icon className="text-muted-foreground h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium">{t(titleKey)}</div>
                <div className="text-muted-foreground text-sm">
                  {t(descKey)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
