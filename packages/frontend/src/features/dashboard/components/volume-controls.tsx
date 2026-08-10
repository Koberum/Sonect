import { Button } from "@/components/ui/button";
import {
  PopoverContent,
  PopoverTrigger,
  Popover,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { setVolume } from "@/features/apis/mpdApis";
import {
  Volume1Icon,
  Volume2Icon,
  VolumeIcon,
  VolumeXIcon,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useMediaQuery } from "react-responsive";

interface VolumeControlsProps {
  volume: number;
  onVolumeCommit?: (volume: number) => void;
}

export default function VolumeControls({
  volume,
  onVolumeCommit,
}: VolumeControlsProps) {
  const [localVolume, setLocalVolume] = useState(volume);
  const isMobile = useMediaQuery({ maxWidth: 768 });

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
      setVolume(newVolume);
    }
  };

  const handleMute = () => {
    setLocalVolume(0);
    if (onVolumeCommit) {
      onVolumeCommit(0);
    } else {
      setVolume(0);
    }
  };

  const getVolumeIcon = () => {
    if (localVolume === 0) return <VolumeXIcon className="h-5 w-5" />;
    if (localVolume <= 33) return <VolumeIcon className="h-5 w-5" />;
    if (localVolume <= 66) return <Volume1Icon className="h-5 w-5" />;
    return <Volume2Icon className="h-5 w-5" />;
  };

  return isMobile ? (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
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
          onValueChange={(newVolumes) => handleVolumeChange(newVolumes[0])}
          onValueCommit={(newVolumes) => handleVolumeCommit(newVolumes[0])}
          className="h-40"
        />
      </PopoverContent>
    </Popover>
  ) : (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
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
        onValueChange={(newVolumes) => handleVolumeChange(newVolumes[0])}
        onValueCommit={(newVolumes) => handleVolumeCommit(newVolumes[0])}
        className="w-20"
      />
    </div>
  );
}
