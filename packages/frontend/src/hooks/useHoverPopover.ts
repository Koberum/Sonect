import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps } from "react";
import { useMediaQuery } from "react-responsive";
import { PopoverContent } from "@/components/ui/popover";

const HOVER_CLOSE_DELAY_MS = 300;

type PopoverContentProps = ComponentProps<typeof PopoverContent>;

type HoverPopoverContentProps = Pick<
  PopoverContentProps,
  | "onOpenAutoFocus"
  | "onPointerDownOutside"
  | "onFocusOutside"
  | "onMouseEnter"
  | "onMouseLeave"
  | "onFocus"
  | "onBlur"
>;

type HoverPopoverTriggerProps = {
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

/**
 * Shared open/close behavior for trigger-anchored popovers:
 * - opens on hover for fine pointers and closes after a short grace period;
 * - a click on a hover-opened trigger pins the popover and focuses its first
 *   available control instead of closing it;
 * - moving the pointer (or focus) into the content keeps it open;
 * - outside clicks and focus changes are delegated to Radix, except clicks on
 *   the anchor, which must not close the popover.
 */
export function useHoverPopover() {
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
      openedByHoverRef.current = false;
      const target =
        contentRef.current?.querySelector<HTMLElement>(
          "[data-popover-initial-focus]",
        ) ??
        contentRef.current?.querySelector<HTMLElement>(
          "button:not([disabled])",
        );
      target?.focus();
      return;
    }
    setOpen((current) => !current);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        clearCloseTimer();
        setOpen(true);
      } else {
        close();
      }
    },
    [clearCloseTimer, close],
  );

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  const triggerProps: HoverPopoverTriggerProps = {
    onClick: handleTriggerClick,
    onMouseEnter: canHover ? openFromHover : undefined,
    onMouseLeave: canHover ? scheduleClose : undefined,
  };

  const contentProps: HoverPopoverContentProps = {
    onOpenAutoFocus: (event) => {
      if (openedByHoverRef.current) event.preventDefault();
    },
    onPointerDownOutside: (event) => {
      const target = event.target as Node | null;
      if (target && anchorRef.current?.contains(target)) {
        event.preventDefault();
      }
    },
    onFocusOutside: (event) => {
      const target = event.target as Node | null;
      if (target && anchorRef.current?.contains(target)) {
        event.preventDefault();
      }
    },
    onMouseEnter: canHover ? clearCloseTimer : undefined,
    onMouseLeave: canHover ? scheduleClose : undefined,
    onFocus: clearCloseTimer,
    onBlur: scheduleClose,
  };

  return {
    open,
    close,
    anchorRef,
    contentRef,
    triggerProps,
    contentProps,
    onOpenChange: handleOpenChange,
  };
}
