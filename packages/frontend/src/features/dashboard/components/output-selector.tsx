import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Speaker } from "lucide-react";
import type { OutputMode } from "@repo/types";
import { useTranslation } from "react-i18next";

interface OutputSelectorProps {
  currentMode: OutputMode;
  onModeChange: (mode: OutputMode) => void;
  deviceName: string | null;
  disabled?: boolean;
}

export function OutputSelector({
  currentMode,
  onModeChange,
  deviceName,
  disabled,
}: OutputSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground gap-1 text-xs"
        >
          <Speaker className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={currentMode}
          onValueChange={(val) => {
            onModeChange(val as OutputMode);
            setOpen(false);
          }}
        >
          <DropdownMenuRadioItem value="mpd">
            {deviceName || t("player.outputMpd")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="browser">
            {t("player.outputBrowser")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
