import { usePlaybackContext } from "@/components/playback-context";
import { usePlayerEngine } from "../player-engine-context";
import { PlaybackControls } from "./playback-controls";
import { PlaybackErrorNotice } from "./playback-error";
import { PlaybackWaveform } from "./playback-waveform";
import { PlayedTrack } from "./playback-track";
import { OutputSelector } from "./output-selector";
import { PlayerVolumeControls } from "./volume-controls";

export default function MusicPlayer() {
  const { trackPlayed, playbackStatus } = usePlaybackContext();
  const { displayElapsed } = usePlayerEngine();

  return (
    <div className="bg-card border-border relative z-30 shrink-0 border-t">
      <PlaybackErrorNotice error={playbackStatus.error} />
      <div className="relative flex h-20 items-center">
        <div className="flex min-w-0 flex-1 justify-start overflow-hidden pl-4">
          {trackPlayed && <PlayedTrack track={trackPlayed} />}
        </div>
        <div className="flex flex-1 flex-col items-center gap-2">
          <PlaybackControls
            playbackStatus={playbackStatus}
            track={trackPlayed}
          />
          <PlaybackWaveform
            elapsed={displayElapsed}
            duration={playbackStatus.duration}
            trackId={playbackStatus.track?.id ?? null}
            className="w-full px-6"
          />
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 pr-4">
          <OutputSelector />
          <PlayerVolumeControls />
        </div>
      </div>
    </div>
  );
}
