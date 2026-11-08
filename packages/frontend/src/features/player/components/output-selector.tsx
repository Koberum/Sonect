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
import { useTranslation } from "react-i18next";
import { getDeviceName, getDeviceType } from "@/lib/deviceId";
import { usePlaybackContext } from "@/components/playback-context";
import { useOutputMode } from "../useOutputMode";

type DeviceValue = "mpd" | "this-browser" | "remote-browser";

/**
 * Output picker shared by both player views. It reads the profile's mode,
 * configured speaker name and active browser device from the player state.
 */
export function OutputSelector({ disabled }: { disabled?: boolean }) {
  const { t } = useTranslation();
  const { activeDeviceId, activeDeviceName, activeDeviceType, myDeviceId } =
    usePlaybackContext();
  const { outputMode, deviceName, isMpdLockedForMe, changeOutputMode } =
    useOutputMode();
  const [open, setOpen] = useState(false);

  const isPlayingElsewhere =
    outputMode === "browser" &&
    !!activeDeviceId &&
    activeDeviceId !== myDeviceId;

  const myDeviceName = getDeviceName();
  const myDeviceType = getDeviceType();
  const MyBrowserIcon = myDeviceType === "mobile" ? Smartphone : Laptop;
  const remoteType = activeDeviceType === "mobile" ? "mobile" : "desktop";
  const RemoteBrowserIcon = remoteType === "mobile" ? Smartphone : Laptop;

  const selectedValue: DeviceValue =
    outputMode === "mpd"
      ? "mpd"
      : isPlayingElsewhere
        ? "remote-browser"
        : "this-browser";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="bare"
          size="icon-sm"
          disabled={disabled}
          aria-label={t("player.outputDevices")}
          className="text-muted-foreground hover:text-foreground"
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
            if (v === "mpd") changeOutputMode("mpd");
            else if (v === "this-browser") changeOutputMode("browser");
            // remote-browser is disabled (highlight only)
            setOpen(false);
          }}
        >
          <DropdownMenuRadioItem value="mpd" disabled={isMpdLockedForMe}>
            <span className="flex items-center gap-2">
              <Speaker className="size-4 shrink-0" />
              <span className="flex flex-col">
                <span className="text-sm leading-none">
                  {t("player.outputSpeakers")}
                </span>
                {isMpdLockedForMe ? (
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
