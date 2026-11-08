import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { useTranslation } from "react-i18next";
import { Check, Laptop, Smartphone, Speaker } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getDeviceName, getDeviceType } from "@/lib/deviceId";
import { usePlaybackContext } from "@/components/playback-context";
import { useOutputMode } from "../useOutputMode";

type DeviceValue = "mpd" | "this-browser" | "remote-browser";

const HOVER_CLOSE_DELAY_MS = 300;

type OutputSelectorProps = {
  /**
   * `bar` anchors the popover to the desktop player bar; `page` opens below
   * the trigger on the full-page mobile player.
   */
  placement?: "bar" | "page";
};

type OutputOption = {
  value: DeviceValue;
  icon: typeof Speaker;
  title: string;
  subtitle?: string;
  disabled?: boolean;
};

/**
 * Output picker shared by both player views. It reads the profile's mode,
 * configured speaker name and active browser device from the player state.
 * On pointer-fine devices it opens on hover with the same grace period as the
 * volume popover; touch and keyboard keep using the trigger.
 */
export function OutputSelector({ placement = "bar" }: OutputSelectorProps) {
  const { t } = useTranslation();
  const { activeDeviceId, activeDeviceName, activeDeviceType, myDeviceId } =
    usePlaybackContext();
  const { outputMode, deviceName, isMpdLockedForMe, changeOutputMode } =
    useOutputMode();
  const canHover = useMediaQuery({
    query: "(hover: hover) and (pointer: fine)",
  });

  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedByHoverRef = useRef(false);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearCloseTimer();
    openedByHoverRef.current = false;
    setOpen(false);
  }, [clearCloseTimer]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      // Keep a click-pinned popover open while keyboard focus is inside it.
      if (contentRef.current?.contains(document.activeElement)) return;
      openedByHoverRef.current = false;
      setOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const openFromHover = useCallback(() => {
    clearCloseTimer();
    openedByHoverRef.current = true;
    setOpen(true);
  }, [clearCloseTimer]);

  const handleTriggerClick = useCallback(() => {
    if (openedByHoverRef.current) {
      // Hover already opened it: a click pins it and moves keyboard focus into
      // the device list instead of closing it again on hybrid pointers.
      openedByHoverRef.current = false;
      contentRef.current?.querySelector<HTMLElement>('[role="radio"]')?.focus();
      return;
    }
    setOpen((current) => !current);
  }, []);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const isPlayingElsewhere =
    outputMode === "browser" &&
    !!activeDeviceId &&
    activeDeviceId !== myDeviceId;

  const myDeviceName = getDeviceName();
  const MyBrowserIcon = getDeviceType() === "mobile" ? Smartphone : Laptop;
  const RemoteBrowserIcon = activeDeviceType === "mobile" ? Smartphone : Laptop;

  const selectedValue: DeviceValue =
    outputMode === "mpd"
      ? "mpd"
      : isPlayingElsewhere
        ? "remote-browser"
        : "this-browser";

  const options: OutputOption[] = [
    {
      value: "mpd",
      icon: Speaker,
      title: t("player.outputSpeakers"),
      subtitle: isMpdLockedForMe
        ? t("player.outputInUse")
        : (deviceName ?? undefined),
      disabled: isMpdLockedForMe,
    },
    {
      value: "this-browser",
      icon: MyBrowserIcon,
      title: t("player.thisDevice"),
      subtitle: myDeviceName,
    },
  ];

  if (isPlayingElsewhere) {
    options.push({
      value: "remote-browser",
      icon: RemoteBrowserIcon,
      title: activeDeviceName || t("player.remoteDevice"),
      subtitle: activeDeviceName ? t("player.remoteDevice") : undefined,
      disabled: true,
    });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          clearCloseTimer();
          setOpen(true);
        } else {
          close();
        }
      }}
    >
      <PopoverAnchor asChild>
        <Button
          ref={anchorRef}
          type="button"
          variant="bare"
          size="icon-sm"
          aria-label={t("player.outputDevices")}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="text-muted-foreground hover:text-foreground"
          onClick={handleTriggerClick}
          onMouseEnter={canHover ? openFromHover : undefined}
          onMouseLeave={canHover ? scheduleClose : undefined}
        >
          <Speaker />
        </Button>
      </PopoverAnchor>

      <PopoverContent
        ref={contentRef}
        side={placement === "page" ? "bottom" : "top"}
        align="end"
        sideOffset={placement === "page" ? 8 : 32}
        aria-label={t("player.outputDevices")}
        onOpenAutoFocus={(event) => {
          if (openedByHoverRef.current) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          const target = event.target as Node | null;
          if (target && anchorRef.current?.contains(target)) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          const target = event.target as Node | null;
          if (target && anchorRef.current?.contains(target)) {
            event.preventDefault();
          }
        }}
        onMouseEnter={canHover ? clearCloseTimer : undefined}
        onMouseLeave={canHover ? scheduleClose : undefined}
        onFocus={clearCloseTimer}
        onBlur={scheduleClose}
        className="w-64 p-2"
      >
        <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
          {t("player.outputDevices")}
        </div>

        <RadioGroupPrimitive.Root
          value={selectedValue}
          onValueChange={(value) => {
            const next = value as DeviceValue;
            if (next === "mpd") void changeOutputMode("mpd");
            else if (next === "this-browser") void changeOutputMode("browser");
            close();
          }}
          aria-label={t("player.outputDevices")}
          className="grid gap-1"
        >
          {options.map((option) => (
            <RadioGroupPrimitive.Item
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              onClick={() => {
                if (option.value === selectedValue) close();
              }}
              className={cn(
                "group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors outline-none",
                "hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "data-[state=checked]:bg-accent/60",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              <option.icon className="text-muted-foreground group-data-[state=checked]:text-foreground size-4 shrink-0" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm leading-tight font-medium">
                  {option.title}
                </span>
                {option.subtitle ? (
                  <span className="text-muted-foreground mt-0.5 truncate text-xs leading-tight">
                    {option.subtitle}
                  </span>
                ) : null}
              </span>
              <RadioGroupPrimitive.Indicator className="text-primary flex size-4 shrink-0 items-center justify-center">
                <Check className="size-4" />
              </RadioGroupPrimitive.Indicator>
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
      </PopoverContent>
    </Popover>
  );
}
