import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "react-responsive";
import { PlaybackControls } from "./playback-controls";
import { PlaybackProgressBar } from "./playback-progress-bar";
import { PlaybackWaveform } from "./playback-waveform";
import { PlayedTrack } from "./playback-track";
import { QueueView } from "./queue-view";
import { FullPagePlayer } from "./full-page-player";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
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
import { usePlayerSocket } from "@/components/ws-provider";
import { OutputSelector } from "./output-selector";
import { useQuery } from "@tanstack/react-query";
import { systemQueries } from "@/features/system/queries";
import { useAuth } from "@/features/auth/auth-context";
import type { TrackWithRelations } from "@repo/types/catalog";
import { useTranslation } from "react-i18next";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { qk } from "@/lib/queryKeys";
import { PlaybackErrorNotice } from "./playback-error";

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
  const lastSeekSeqRef = useRef(0);
  const [interpolatedElapsed, setInterpolatedElapsed] = useState(0);
  const [playerSheetOpen, setPlayerSheetOpen] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 768 });
  const { t } = useTranslation();
  const { sendReport } = usePlayerSocket();
  const browserAudio = useBrowserAudio({
    onReport: sendReport,
    onError: () => toast.error(t("player.playbackError")),
  });
  const { startTrack, play, pause, seek, preloadTrack } = browserAudio;
  const { profile } = useAuth();
  const { data: outputModeData } = useQuery(systemQueries.outputMode());
  const mpdOwner = outputModeData?.mpdOwner ?? null;
  const mySid = profile?.id ?? "";
  const isMpdLockedForMe =
    !!mpdOwner && mpdOwner !== mySid && outputMode !== "mpd";

  // Browser audio sync - only active browser device renders audio
  const isActiveBrowser =
    outputMode === "browser" &&
    (!activeDeviceId || activeDeviceId === myDeviceId);

  // Browser mode: mirror the server's queue/state into the local engine. The
  // engine owns timing, so the UI only follows `currentTime`, never a clock.
  useEffect(() => {
    if (!isActiveBrowser) {
      pause();
      return;
    }

    const track = playbackStatus.track;
    if (track?.id) {
      startTrack(
        track.id,
        `/stream/${track.id}`,
        playbackStatus.elapsed || 0,
        playbackStatus.seekSeq ?? 0,
      );
    }

    if (playbackStatus.state === "play") {
      play();
    } else {
      pause();
    }
  }, [playbackStatus, isActiveBrowser, startTrack, play, pause]);

  // A remote seek (other device) bumps seekSeq. Local reports never do, so the
  // active browser does not fight its own position.
  useEffect(() => {
    if (!isActiveBrowser || playbackStatus.state === "stop") return;
    const seq = playbackStatus.seekSeq ?? 0;
    if (seq === lastSeekSeqRef.current) return;
    lastSeekSeqRef.current = seq;
    seek(playbackStatus.elapsed);
  }, [
    isActiveBrowser,
    playbackStatus.seekSeq,
    playbackStatus.elapsed,
    playbackStatus.state,
    seek,
  ]);

  // Preload the upcoming track on the standby deck so the transition is
  // instant and the backend can expose nextTrackId ahead of time.
  useEffect(() => {
    if (!isActiveBrowser) return;
    const nextId = playbackStatus.nextTrackId;
    const currentId = playbackStatus.track?.id;
    if (nextId && nextId !== currentId) {
      preloadTrack(nextId, `/stream/${nextId}`);
    }
  }, [
    isActiveBrowser,
    playbackStatus.nextTrackId,
    playbackStatus.track?.id,
    preloadTrack,
  ]);

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
    // The active browser reads the real audio clock; only passive/MPD devices
    // need to interpolate between server updates.
    if (isActiveBrowser) return;
    if (playbackStatus.state !== "play" || playbackStatus.buffering) {
      setInterpolatedElapsed(playbackStatus.elapsed);
      return;
    }

    lastAnchorRef.current = {
      time: Date.now(),
      elapsed: playbackStatus.elapsed,
    };
    setInterpolatedElapsed(playbackStatus.elapsed);

    const id = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastAnchorRef.current.time) / 1000;
      lastAnchorRef.current.time = now;
      lastAnchorRef.current.elapsed += delta;
      setInterpolatedElapsed(lastAnchorRef.current.elapsed);
    }, 250);

    return () => clearInterval(id);
  }, [playbackStatus, isActiveBrowser]);

  const displayElapsed = isActiveBrowser
    ? browserAudio.currentTime
    : interpolatedElapsed;

  return (
    <>
      {isActiveBrowser &&
        browserAudio.autoplayBlocked &&
        playbackStatus.state === "play" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 fixed bottom-24 left-1/2 z-[60] -translate-x-1/2">
            <Button
              onClick={() => browserAudio.play()}
              className="rounded-full shadow-lg"
            >
              <Play />
              {t("player.tapToPlay")}
            </Button>
          </div>
        )}
      <div
        className={`bg-card border-border fixed right-0 bottom-0 left-0 z-50 border border-b-0 pb-[env(safe-area-inset-bottom)] transition-all duration-300 ease-in-out`}
      >
        <PlaybackErrorNotice error={playbackStatus.error} />
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
            <div className="hidden w-full md:flex">
              <PlaybackWaveform
                elapsed={displayElapsed}
                duration={playbackStatus.duration}
                trackId={playbackStatus.track?.id ?? null}
                className="w-full pr-6 pl-6"
                outputMode={outputMode}
              />
            </div>
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
