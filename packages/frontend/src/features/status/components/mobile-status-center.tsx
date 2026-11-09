import { useState } from "react";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { StatusTone } from "../types";
import { useStatusCenter } from "../use-status-center";
import { StatusCenterContent } from "./status-center-content";

function pillTone(tone: StatusTone): string {
  switch (tone) {
    case "error":
      return "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15";
    case "warning":
      return "border-warning/30 bg-warning/10 text-warning hover:bg-warning/15";
    default:
      return "border-border bg-secondary text-foreground";
  }
}

function PillIcon({ tone }: { tone: StatusTone }) {
  if (tone === "error") {
    return <AlertTriangle className="size-4 shrink-0" />;
  }
  if (tone === "warning") {
    return <AlertCircle className="size-4 shrink-0" />;
  }
  return <Loader2 className="size-4 shrink-0 animate-spin" />;
}

export function MobileStatusCenter() {
  const { t } = useTranslation();
  const status = useStatusCenter();
  const [open, setOpen] = useState(false);
  const { topItem, items } = status;

  if (!topItem) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className={cn(
              "max-w-[calc(100vw-2rem)] rounded-full border shadow-lg",
              pillTone(topItem.tone),
            )}
            aria-label={t("status.openWith", {
              status: t(topItem.titleKey),
            })}
          >
            <PillIcon tone={topItem.tone} />
            <span className="max-w-40 truncate">{t(topItem.titleKey)}</span>
            {topItem.progress !== undefined && topItem.progress !== null && (
              <span className="shrink-0 tabular-nums">{topItem.progress}%</span>
            )}
            {items.length > 1 && (
              <span className="shrink-0 tabular-nums">+{items.length - 1}</span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] p-0 pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("status.title")}</SheetTitle>
            <SheetDescription>{t("status.description")}</SheetDescription>
          </SheetHeader>
          <StatusCenterContent
            status={status}
            className="max-h-[85vh]"
            onNavigate={() => setOpen(false)}
            sheet
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
