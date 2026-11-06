import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "react-responsive";
import { usePlaybackContext } from "@/components/playback-context";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/features/auth/auth-context";
import { getSyncPercent, getSyncPhaseMeta } from "@/features/sync/sync-phase";
import { SyncProgressView } from "./sync-progress-view";

export function SyncIndicator() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { syncProgress } = usePlaybackContext();
  const isMobile = useMediaQuery({ maxWidth: 767.98 });

  if (!isAdmin || !syncProgress) return null;

  const meta = getSyncPhaseMeta(syncProgress);
  const percent = getSyncPercent(syncProgress);

  const trigger = (
    <Button
      variant="secondary"
      size="sm"
      className="rounded-full shadow-lg"
      aria-label={t("sync.openDetails")}
    >
      <Loader2 className="animate-spin" />
      <span className="max-w-40 truncate">{t(meta.labelKey)}</span>
      {percent !== null && (
        <span className="text-muted-foreground tabular-nums">{percent}%</span>
      )}
    </Button>
  );

  return (
    <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2">
      {isMobile ? (
        <Sheet>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle>{t("sync.title")}</SheetTitle>
              <SheetDescription>
                {t("sync.runningDescription")}
              </SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <SyncProgressView progress={syncProgress} />
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Popover>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-80">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{t("sync.title")}</p>
                <p className="text-muted-foreground text-xs">
                  {t("sync.runningDescription")}
                </p>
              </div>
              <SyncProgressView progress={syncProgress} />
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
