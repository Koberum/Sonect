import { Button } from "@/components/ui/button";
import {
  PopoverContent,
  PopoverTrigger,
  Popover,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { setVolume as persistVolume } from "@/features/player/api";
import {
  Volume1Icon,
  Volume2Icon,
  VolumeIcon,
  VolumeXIcon,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { usePlaybackContext } from "@/components/playback-context";
import { usePlayerEngine } from "../player-engine-context";

interface VolumeControlsProps {
  volume: number;
  onVolumeCommit?: (volume: number) => void;
  fullWidth?: boolean;
}

export default function VolumeControls({
  volume,
  onVolumeCommit,
  fullWidth = false,
}: VolumeControlsProps) {
  const { t } = useTranslation();
  const [localVolume, setLocalVolume] = useState(volume);
  const isMobile = useMediaQuery({ maxWidth: 767.98 });

  useEffect(() => {
    setLocalVolume(volume);
  }, [volume]);

  const handleVolumeChange = (newVolume: number) => {
    setLocalVolume(newVolume);
  };

  const handleVolumeCommit = (newVolume: number) => {
    if (onVolumeCommit) {
      onVolumeCommit(newVolume);
    } else {
      void persistVolume(newVolume).catch(() =>
        toast.error(t("player.volumeError")),
      );
    }
  };

  const handleMute = () => {
    setLocalVolume(0);
    if (onVolumeCommit) {
      onVolumeCommit(0);
    } else {
      void persistVolume(0).catch(() => toast.error(t("player.volumeError")));
    }
  };

  const getVolumeIcon = () => {
    if (localVolume === 0) return <VolumeXIcon className="h-5 w-5" />;
    if (localVolume <= 33) return <VolumeIcon className="h-5 w-5" />;
    if (localVolume <= 66) return <Volume1Icon className="h-5 w-5" />;
    return <Volume2Icon className="h-5 w-5" />;
  };

  if (fullWidth) {
    return (
      <div className="flex w-full items-center gap-3">
        <Slider
          defaultValue={[localVolume]}
          value={[localVolume]}
          min={0}
          max={100}
          step={1}
          aria-label={t("player.volume")}
          onValueChange={(newVolumes) => handleVolumeChange(newVolumes[0])}
          onValueCommit={(newVolumes) => handleVolumeCommit(newVolumes[0])}
          className="flex-1"
        />
        <Button
          variant="bare"
          size="icon"
          aria-label={t("player.volume")}
          className="text-muted-foreground hover:text-foreground shrink-0"
          onClick={handleMute}
        >
          {getVolumeIcon()}
        </Button>
      </div>
    );
  }

  return isMobile ? (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="bare"
          size="icon"
          aria-label={t("player.volume")}
          className="text-muted-foreground hover:text-foreground"
        >
          {getVolumeIcon()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-0 items-center justify-center p-4">
        <Slider
          defaultValue={[localVolume]}
          value={[localVolume]}
          min={0}
          max={100}
          step={1}
          orientation="vertical"
          aria-label={t("player.volume")}
          onValueChange={(newVolumes) => handleVolumeChange(newVolumes[0])}
          onValueCommit={(newVolumes) => handleVolumeCommit(newVolumes[0])}
          className="h-40"
        />
      </PopoverContent>
    </Popover>
  ) : (
    <div className="flex items-center gap-1">
      <Button
        variant="bare"
        size="icon"
        aria-label={t("player.volume")}
        className="text-muted-foreground hover:text-foreground"
        onClick={handleMute}
      >
        {getVolumeIcon()}
      </Button>
      <Slider
        defaultValue={[localVolume]}
        value={[localVolume]}
        min={0}
        max={100}
        step={1}
        aria-label={t("player.volume")}
        onValueChange={(newVolumes) => handleVolumeChange(newVolumes[0])}
        onValueCommit={(newVolumes) => handleVolumeCommit(newVolumes[0])}
        className="w-20"
      />
    </div>
  );
}

/**
 * Player-aware volume control: the active browser commits to its local engine,
 * passive devices and MPD commit through the shared player API.
 */
export function PlayerVolumeControls({
  fullWidth = false,
}: {
  fullWidth?: boolean;
}) {
  const { t } = useTranslation();
  const { playbackStatus, applyPlaybackStatus } = usePlaybackContext();
  const { isActiveBrowser, volume, setVolume } = usePlayerEngine();

  const commitVolume = (nextVolume: number) => {
    const previousVolume = volume;
    setVolume(nextVolume);
    void persistVolume(nextVolume)
      .then(applyPlaybackStatus)
      .catch(() => {
        setVolume(previousVolume);
        toast.error(t("player.volumeError"));
      });
  };

  return (
    <VolumeControls
      volume={isActiveBrowser ? volume : playbackStatus.volume}
      onVolumeCommit={isActiveBrowser ? commitVolume : undefined}
      fullWidth={fullWidth}
    />
  );
}
