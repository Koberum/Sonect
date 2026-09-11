import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { PlaybackControls } from "./playback-controls";
import { PlaybackProgressBar } from "./playback-progress-bar";
import { PlayedTrack } from "./playback-track";
import { QueueView } from "./queue-view";
import { FullPagePlayer } from "./full-page-player";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { OutputMode } from "@repo/types";
import {
  nextTrack,
  pauseSong,
  playSong,
  previousTrack,
  setRandom,
  setRepeat,
} from "@/features/apis/mpdApis";
import { usePlaybackContext } from "@/components/playback-context";
import VolumeControls from "./volume-controls";
import { useBrowserAudio } from "@/lib/useBrowserAudio";
import { OutputSelector } from "./output-selector";
import {
  getOutputMode,
  setOutputMode as setOutputModeApi,
} from "@/features/apis/systemApis";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";

export default function MusicPlayer() {
  const {
    trackPlayed,
    setTrackPlayed,
    playbackStatus,
    outputMode,
    setOutputMode,
  } = usePlaybackContext();

  const lastAnchorRef = useRef({ time: 0, elapsed: 0 });
  const [displayElapsed, setDisplayElapsed] = useState(0);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const browserAudio = useBrowserAudio();
  const prevTrackFileRef = useRef<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    prevTrackFileRef.current = null;
  }, []);

  // Browser audio sync
  useEffect(() => {
    if (outputMode !== "browser") return;

    const track = playbackStatus.track;
    if (track?.file) {
      const streamUrl = `/stream/${track.file}`;
      if (track.file !== prevTrackFileRef.current) {
        prevTrackFileRef.current = track.file;
        browserAudio.loadTrack(streamUrl, playbackStatus.elapsed || 0);
      }
    }

    if (playbackStatus.state === "play") {
      browserAudio.play();
      if (playbackStatus.elapsed !== undefined) {
        const diff = Math.abs(
          browserAudio.currentTime - playbackStatus.elapsed,
        );
        if (diff > 3) {
          browserAudio.seek(playbackStatus.elapsed);
        }
      }
    } else {
      browserAudio.pause();
    }
  }, [playbackStatus, outputMode, browserAudio]);

  // Track change detection
  useEffect(() => {
    if (playbackStatus.track && playbackStatus.track.id !== trackPlayed?.id) {
      setTrackPlayed(playbackStatus.track);
    }
  }, [playbackStatus.track, trackPlayed, setTrackPlayed]);

  const handleOutputModeChange = async (mode: OutputMode) => {
    try {
      await setOutputModeApi(mode);
      setOutputMode(mode);
    } catch {
      console.error(t("player.outputModeError"));
    }
  };

  const [deviceName, setDeviceName] = useState<string | null>(null);

  useEffect(() => {
    getOutputMode()
      .then((res) => {
        setOutputMode(res.mode);
        setDeviceName(res.deviceName);
      })
      .catch(() => {});
  }, [setOutputMode]);

  useEffect(() => {
    if (playbackStatus.state !== "play") {
      setDisplayElapsed(playbackStatus.elapsed);
      return;
    }

    lastAnchorRef.current = {
      time: Date.now(),
      elapsed: playbackStatus.elapsed,
    };
    setDisplayElapsed(playbackStatus.elapsed);

    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastAnchorRef.current.time) / 1000;
      lastAnchorRef.current.time = now;
      lastAnchorRef.current.elapsed += delta;
      setDisplayElapsed(lastAnchorRef.current.elapsed);
    }, 250);

    return () => clearInterval(id);
  }, [playbackStatus]);

  return (
    <>
      {browserAudio.autoplayBlocked && playbackStatus.state === "play" && (
        <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-24 left-1/2 z-[60] -translate-x-1/2">
          <button
            onClick={() => browserAudio.play()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium shadow-lg"
          >
            <Play className="h-4 w-4" />
            {t("player.tapToPlay")}
          </button>
        </div>
      )}
      <div
        className={`bg-card border-border fixed right-0 bottom-0 left-0 z-50 border border-b-0 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-in-out`}
      >
        <div className="absolute top-0 left-0 z-10 block w-full md:hidden">
          <PlaybackProgressBar
            elapsed={displayElapsed}
            duration={playbackStatus.duration}
            className="h-1 w-full"
          />
        </div>
        <div className="relative flex h-20 items-center">
          <div
            className={`flex min-w-0 flex-1 justify-start overflow-hidden pl-4 ${isMobile && trackPlayed ? "cursor-pointer" : ""}`}
            onClick={() => {
              if (isMobile && trackPlayed) setPlayerSheetOpen(true);
            }}
            role={isMobile && trackPlayed ? "button" : undefined}
            tabIndex={isMobile && trackPlayed ? 0 : undefined}
            onKeyDown={(e) => {
              if (
                isMobile &&
                trackPlayed &&
                (e.key === "Enter" || e.key === " ")
              ) {
                e.preventDefault();
                setPlayerSheetOpen(true);
              }
            }}
          >
            {trackPlayed && (
              <PlayedTrack
                title={trackPlayed?.title}
                artist={trackPlayed?.artist_name ?? ""}
                cover_path={trackPlayed?.cover_path}
              />
            )}
          </div>
          <div className="flex flex-1 flex-col items-center gap-2">
            <PlaybackControls
              playbackStatus={playbackStatus}
              playTrack={() => {
                if (trackPlayed) playSong(trackPlayed);
              }}
              pauseTrack={() => {
                pauseSong();
              }}
              nextTrack={() => {
                nextTrack();
              }}
              previousTrack={() => {
                previousTrack();
              }}
              setRandom={(enabled) => setRandom(enabled)}
              setRepeat={(enabled) => setRepeat(enabled)}
            />

            <div className="hidden w-full md:flex">
              <PlaybackProgressBar
                elapsed={displayElapsed}
                duration={playbackStatus.duration}
                className="w-full pr-6 pl-6"
              />
            </div>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 pr-4">
            <QueueView currentTrackFile={playbackStatus.track?.file} />
            <OutputSelector
              currentMode={outputMode}
              onModeChange={handleOutputModeChange}
              deviceName={deviceName}
            />
            <VolumeControls
              volume={
                outputMode === "browser"
                  ? browserAudio.volume
                  : playbackStatus.volume
              }
              onVolumeCommit={
                outputMode === "browser" ? browserAudio.setVolume : undefined
              }
            />
          </div>
        </div>
      </div>

      <Sheet open={playerSheetOpen} onOpenChange={setPlayerSheetOpen}>
        <SheetContent side="bottom" className="h-dvh pt-10">
          <FullPagePlayer
            displayElapsed={displayElapsed}
            browserVolume={browserAudio.volume}
            browserSetVolume={browserAudio.setVolume}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
