import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { usePlaybackContext } from "@/components/playback-context";
import { usePlayerEngine } from "../player-engine-context";

/**
 * Global retry affordance for browsers that blocked autoplay. Rendered once by
 * MainLayout so it also reaches the mobile full player.
 */
export function AutoplayNotice() {
  const { t } = useTranslation();
  const { playbackStatus } = usePlaybackContext();
  const { isActiveBrowser, autoplayBlocked, play } = usePlayerEngine();

  if (!isActiveBrowser || !autoplayBlocked || playbackStatus.state !== "play") {
    return null;
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-36 left-1/2 z-[60] -translate-x-1/2">
      <Button onClick={play} className="rounded-full shadow-lg">
        <Play />
        {t("player.tapToPlay")}
      </Button>
    </div>
  );
}
