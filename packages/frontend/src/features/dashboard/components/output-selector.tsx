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
  mpdOwner?: string | null;
  mySid?: string;
  disabledMpd?: boolean;
  activeDeviceId?: string | null;
  myDeviceId?: string;
}

export function OutputSelector({
  currentMode,
  onModeChange,
  deviceName,
  disabled,
  mpdOwner,
  disabledMpd,
  activeDeviceId,
  myDeviceId,
}: OutputSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isBrowserActiveForMe =
    currentMode === "browser" &&
    (!activeDeviceId || activeDeviceId === myDeviceId);
  const isPlayingElsewhere =
    currentMode === "browser" &&
    !!activeDeviceId &&
    activeDeviceId !== myDeviceId;

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
          <DropdownMenuRadioItem
            value="mpd"
            disabled={!!disabledMpd}
            title={
              disabledMpd
                ? `MPD locked by ${mpdOwner?.slice(0, 8) ?? "another session"}`
                : undefined
            }
          >
            {deviceName || t("player.outputMpd")}
            {disabledMpd ? ` (${t("player.mpdLocked") ?? "locked"})` : ""}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="browser">
            {t("player.outputBrowser")}
            {isBrowserActiveForMe ? ` (${t("player.outputThisBrowser")})` : ""}
            {isPlayingElsewhere
              ? ` (${t("player.playingOnOtherBrowser")})`
              : ""}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
