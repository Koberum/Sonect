import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Speaker, Laptop, Smartphone } from "lucide-react";
import type { OutputMode } from "@repo/types";
import { useTranslation } from "react-i18next";
import { getDeviceName, getDeviceType } from "@/lib/deviceId";

type DeviceValue = "mpd" | "this-browser" | "remote-browser";

interface OutputSelectorProps {
  currentMode: OutputMode;
  onModeChange: (mode: OutputMode) => void;
  deviceName: string | null;
  disabled?: boolean;
  disabledMpd?: boolean;
  activeDeviceId?: string | null;
  activeDeviceName?: string | null;
  activeDeviceType?: string | null;
  myDeviceId?: string;
}

export function OutputSelector({
  currentMode,
  onModeChange,
  deviceName,
  disabled,
  disabledMpd,
  activeDeviceId,
  activeDeviceName,
  activeDeviceType,
  myDeviceId,
}: OutputSelectorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const isPlayingElsewhere =
    currentMode === "browser" &&
    !!activeDeviceId &&
    activeDeviceId !== myDeviceId;

  const myDeviceName = getDeviceName();
  const myDeviceType = getDeviceType();
  const MyBrowserIcon = myDeviceType === "mobile" ? Smartphone : Laptop;
  const remoteType = activeDeviceType === "mobile" ? "mobile" : "desktop";
  const RemoteBrowserIcon = remoteType === "mobile" ? Smartphone : Laptop;

  const selectedValue: DeviceValue =
    currentMode === "mpd"
      ? "mpd"
      : isPlayingElsewhere
        ? "remote-browser"
        : "this-browser";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="bare"
          size="sm"
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground gap-1 text-xs"
        >
          <Speaker className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel>{t("player.outputDevices")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={selectedValue}
          onValueChange={(val) => {
            const v = val as DeviceValue;
            if (v === "mpd") onModeChange("mpd");
            else if (v === "this-browser") onModeChange("browser");
            // remote-browser is disabled (highlight only)
            setOpen(false);
          }}
        >
          <DropdownMenuRadioItem value="mpd" disabled={!!disabledMpd}>
            <span className="flex items-center gap-2">
              <Speaker className="size-4 shrink-0" />
              <span className="flex flex-col">
                <span className="text-sm leading-none">
                  {t("player.outputSpeakers")}
                </span>
                {disabledMpd ? (
                  <span className="text-muted-foreground text-xs leading-none">
                    {t("player.outputInUse")}
                  </span>
                ) : deviceName ? (
                  <span className="text-muted-foreground text-xs leading-none">
                    {deviceName}
                  </span>
                ) : null}
              </span>
            </span>
          </DropdownMenuRadioItem>

          <DropdownMenuRadioItem value="this-browser">
            <span className="flex items-center gap-2">
              <MyBrowserIcon className="size-4 shrink-0" />
              <span className="flex flex-col">
                <span className="text-sm leading-none">
                  {t("player.thisDevice")}
                </span>
                <span className="text-muted-foreground text-xs leading-none">
                  {myDeviceName}
                </span>
              </span>
            </span>
          </DropdownMenuRadioItem>

          {isPlayingElsewhere ? (
            <DropdownMenuRadioItem value="remote-browser" disabled>
              <span className="flex items-center gap-2">
                <RemoteBrowserIcon className="size-4 shrink-0" />
                <span className="flex flex-col">
                  <span className="text-sm leading-none">
                    {activeDeviceName || t("player.remoteDevice")}
                  </span>
                  {activeDeviceName ? (
                    <span className="text-muted-foreground text-xs leading-none">
                      {t("player.remoteDevice")}
                    </span>
                  ) : null}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ) : null}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
