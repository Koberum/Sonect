import { Disc3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router-dom";
import { useMediaQuery } from "react-responsive";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { usePlaybackContext } from "@/components/playback-context";
import { FullPagePlayer } from "@/features/player/components/full-page-player";

export default function PlayerPage() {
  const { t } = useTranslation();
  const { trackPlayed } = usePlaybackContext();
  const isMobile = useMediaQuery({ maxWidth: 767 });

  if (!isMobile) return <Navigate to="/home" replace />;

  if (!trackPlayed) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <h1 className="sr-only">{t("player.title")}</h1>
        <EmptyState
          icon={Disc3}
          title={t("player.nothingPlaying")}
          description={t("player.nothingPlayingDescription")}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/home">{t("nav.home")}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return <FullPagePlayer />;
}
