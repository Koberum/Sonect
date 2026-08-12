import { useTranslation } from "react-i18next";
import { Folder, HardDrive, Server } from "lucide-react";
import {
  SelectableRow,
  SelectableRowDescription,
  SelectableRowIcon,
  SelectableRowTitle,
} from "@/components/ui/selectable-row";

export type SourceType = "smb" | "nfs" | "local";

const libraryTypeConfig: {
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

interface LibrarySourcePickerProps {
  onSelect: (type: SourceType) => void;
}

export function LibrarySourcePicker({ onSelect }: LibrarySourcePickerProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-3">
      {libraryTypeConfig.map(({ value, icon: Icon, titleKey, descKey }) => (
        <SelectableRow key={value} asChild className="gap-4 p-4 text-left">
          <button type="button" onClick={() => onSelect(value)}>
            <SelectableRowIcon>
              <Icon className="h-5 w-5" />
            </SelectableRowIcon>
            <div className="min-w-0 flex-1">
              <SelectableRowTitle>{t(titleKey)}</SelectableRowTitle>
              <SelectableRowDescription>{t(descKey)}</SelectableRowDescription>
            </div>
          </button>
        </SelectableRow>
      ))}
    </div>
  );
}
