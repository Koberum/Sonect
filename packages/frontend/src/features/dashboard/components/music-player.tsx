import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { PlaybackControls } from "./playback-controls";
import { PlaybackProgressBar } from "./playback-progress-bar";
import { PlaybackWaveform } from "./playback-waveform";
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
  resumeSong,
  setOutputMode as apiSetOutputMode,
  setRandom,
  setRepeat,
} from "@/features/player/api";
import { usePlaybackContext } from "@/components/playback-context";
import VolumeControls from "./volume-controls";
import { useBrowserAudio } from "@/lib/useBrowserAudio";
import { OutputSelector } from "./output-selector";
import { useQuery } from "@tanstack/react-query";
import { systemQueries } from "@/features/system/queries";
import { getClientSessionId } from "@/lib/session";
import type { TrackWithRelations } from "@repo/types/catalog";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { qk } from "@/lib/queryKeys";

export default function MusicPlayer() {
  const {
    trackPlayed,
    setTrackPlayed,
    playbackStatus,
    outputMode,
    setOutputMode,
    activeDeviceId,
    activeDeviceName,
    activeDeviceType,
    myDeviceId,
  } = usePlaybackContext();

  const lastAnchorRef = useRef({ time: 0, elapsed: 0 });
  const [displayElapsed, setDisplayElapsed] = useState(0);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const browserAudio = useBrowserAudio();
  const prevTrackFileRef = useRef<string | null>(null);
  const { t } = useTranslation();
  const { data: outputModeData } = useQuery(systemQueries.outputMode());
  const mpdOwner = outputModeData?.mpdOwner ?? null;
  const mySid = getClientSessionId();
  const isMpdLockedForMe =
    !!mpdOwner && mpdOwner !== mySid && outputMode !== "mpd";

  useEffect(() => {
    prevTrackFileRef.current = null;
  }, []);

  // Browser audio sync - only active browser device renders audio
  const isActiveBrowser =
    outputMode === "browser" &&
    (!activeDeviceId || activeDeviceId === myDeviceId);

  useEffect(() => {
    if (!isActiveBrowser) {
      browserAudio.pause();
      return;
    }

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
  }, [playbackStatus, outputMode, browserAudio, isActiveBrowser]);

  // Ensure browser audio stops immediately when switching away from active browser output
  useEffect(() => {
    if (!isActiveBrowser) {
      browserAudio.pause();
      // Reset prev file so returning to browser reloads at new seek
      if (
        outputMode !== "browser" ||
        (activeDeviceId && activeDeviceId !== myDeviceId)
      ) {
        prevTrackFileRef.current = null;
      }
    }
  }, [outputMode, browserAudio, isActiveBrowser, activeDeviceId, myDeviceId]);

  // Track change detection
  useEffect(() => {
    if (playbackStatus.track && playbackStatus.track.id !== trackPlayed?.id) {
      setTrackPlayed(playbackStatus.track);
    }
  }, [playbackStatus.track, trackPlayed, setTrackPlayed]);

  const handleOutputModeChange = async (mode: OutputMode) => {
    const prev = outputMode;
    setOutputMode(mode);
    try {
      await apiSetOutputMode(mode);
      // optimistic active device for browser handoff
      queryClient.invalidateQueries({ queryKey: qk.player.queue() });
      queryClient.invalidateQueries({ queryKey: qk.system.outputMode() });
    } catch (err) {
      setOutputMode(prev);
      if (err instanceof ApiError && err.status === 423) {
        toast.error(
          t("player.outputModeLocked", {
            defaultValue: "MPD output locked by another session",
          }),
        );
      } else {
        toast.error(t("player.outputModeError"));
      }
    }
  };

  // Unified backend: single /player interface, backend decides per-session engine.
  // Browser queues are isolated per X-Session-Id; MPD queue is shared but locked to one session.
  const doPlay = (t: TrackWithRelations | null) => t && playSong(t);
  const doPause = () => pauseSong();
  const doResume = () => resumeSong();
  const doNext = () => nextTrack();
  const doPrev = () => previousTrack();

  const doToggle = (fn: () => Promise<void>) => fn();

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
      {isActiveBrowser &&
        browserAudio.autoplayBlocked &&
        playbackStatus.state === "play" && (
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
            className="w-full"
            outputMode={outputMode}
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
            {trackPlayed && <PlayedTrack track={trackPlayed} />}
          </div>
          <div className="flex flex-1 flex-col items-center gap-2">
            <div className="hidden w-full md:flex">
              <PlaybackWaveform
                elapsed={displayElapsed}
                duration={playbackStatus.duration}
                trackId={playbackStatus.track?.id ?? null}
                className="w-full pr-6 pl-6"
                outputMode={outputMode}
              />
            </div>

            <PlaybackControls
              playbackStatus={playbackStatus}
              playTrack={() => {
                if (trackPlayed) doPlay(trackPlayed);
              }}
              pauseTrack={() => {
                doPause();
              }}
              resumeTrack={() => {
                doResume();
              }}
              nextTrack={() => {
                doNext();
              }}
              previousTrack={() => {
                doPrev();
              }}
              setRandom={(enabled) => doToggle(() => setRandom(enabled))}
              setRepeat={(enabled) => doToggle(() => setRepeat(enabled))}
            />
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 pr-4">
            <QueueView currentTrackFile={playbackStatus.track?.file} />
            <OutputSelector
              currentMode={outputMode}
              onModeChange={handleOutputModeChange}
              deviceName={null}
              mpdOwner={mpdOwner}
              mySid={mySid}
              disabledMpd={isMpdLockedForMe}
              activeDeviceId={activeDeviceId}
              activeDeviceName={activeDeviceName}
              activeDeviceType={activeDeviceType}
              myDeviceId={myDeviceId}
            />
            <VolumeControls
              volume={
                isActiveBrowser ? browserAudio.volume : playbackStatus.volume
              }
              onVolumeCommit={
                isActiveBrowser ? browserAudio.setVolume : undefined
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
            open={playerSheetOpen}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
