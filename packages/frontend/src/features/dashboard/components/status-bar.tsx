import { useEffect, useRef, useReducer } from "react";
import { usePlaybackContext } from "@/components/playback-context";
import { Check, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

type ViewState = "hidden" | "progress" | "success";

function viewReducer(_state: ViewState, action: ViewState): ViewState {
  return action;
}

export function StatusBar() {
  const { t } = useTranslation();
  const { syncProgress } = usePlaybackContext();
  const [view, dispatch] = useReducer(viewReducer, "hidden");
  const prevSyncRef = useRef(syncProgress);

  useEffect(() => {
    if (prevSyncRef.current !== null && syncProgress === null) {
      dispatch("success");
      const timer = setTimeout(() => dispatch("hidden"), 3000);
      prevSyncRef.current = syncProgress;
      return () => clearTimeout(timer);
    }
    if (syncProgress !== null) {
      dispatch("progress");
    }
    prevSyncRef.current = syncProgress;
  }, [syncProgress]);

  if (view === "success") {
    return (
      <div className="bg-background flex items-center justify-center px-4">
        <div className="flex items-center gap-2 py-1">
          <Check className="h-4 w-4 shrink-0 text-green-500" />
          <span className="text-xs font-medium md:text-sm">
            {t("sync.complete")}
          </span>
        </div>
      </div>
    );
  }

  if (!syncProgress) return null;

  const phase = syncProgress.phase;
  const current = syncProgress.current ?? 0;
  const total = syncProgress.total ?? 0;
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  const phaseLabel =
    phase === "mpd"
      ? t("sync.scanningMpd")
      : phase === "covers"
        ? t("sync.syncingCovers")
        : t("sync.syncingTracks");

  return (
    <div className="bg-background flex items-center justify-center px-4">
      <div className="flex items-center gap-2 py-1">
        <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2 text-xs font-medium md:text-sm">
            <span>{phaseLabel}</span>
            {total > 0 && (
              <span className="text-muted-foreground text-xs md:text-sm">
                {percent}%
              </span>
            )}
          </div>
          {syncProgress.track && (
            <div className="text-muted-foreground hidden max-w-xs truncate text-xs md:block">
              {syncProgress.track.title} — {syncProgress.track.artist} ·{" "}
              {syncProgress.track.album}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
