import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePlaybackContext } from "@/components/playback-context";
import { usePlayerSocket } from "@/components/ws-provider";
import { setVolume as persistVolume } from "@/features/player/api";
import { useVolumePreference } from "@/features/player/use-volume-preference";
import { DEFAULT_VOLUME } from "@/lib/volume";
import { useBrowserAudio } from "@/lib/useBrowserAudio";
import type { PlayerReport } from "@repo/types";

type PlayerEngineContextValue = {
  isActiveBrowser: boolean;
  displayElapsed: number;
  autoplayBlocked: boolean;
  volume: number;
  muted: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  resetVolume: () => void;
  play: () => void;
};

const PlayerEngineContext = createContext<PlayerEngineContextValue | null>(
  null,
);

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayerEngine(): PlayerEngineContextValue {
  const value = useContext(PlayerEngineContext);
  if (!value) {
    throw new Error("usePlayerEngine must be used inside PlayerEngineProvider");
  }
  return value;
}

/**
 * Owns the single browser audio engine and mirrors server playback state into
 * it. Mounted by MainLayout so playback survives route and viewport changes.
 * The compact desktop player and the mobile full player are only views.
 */
export function PlayerEngineProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    playbackStatus,
    outputMode,
    activeDeviceId,
    myDeviceId,
    applyPlaybackStatus,
  } = usePlaybackContext();
  const { t } = useTranslation();
  const { sendReport } = usePlayerSocket();
  const volumePreference = useVolumePreference();

  const lastAnchorRef = useRef({ time: 0, elapsed: 0 });
  const lastSeekSeqRef = useRef(0);
  const lastEpochRef = useRef<string | undefined>(undefined);
  const [interpolatedElapsed, setInterpolatedElapsed] = useState(0);
  const initialPushStartedRef = useRef(false);
  const initialPushDoneRef = useRef(false);
  const lastPushedVolumeRef = useRef<number | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const browserAudio = useBrowserAudio({
    onReport: (report: PlayerReport) => sendReport(report),
    onError: () => toast.error(t("player.playbackError")),
    initialVolume: volumePreference.effectiveVolume,
  });
  const {
    startTrack,
    play,
    pause,
    seek,
    preloadTrack,
    clearPreload,
    setCrossfade,
    setVolume: setEngineVolume,
    autoplayBlocked,
  } = browserAudio;

  // Only the active browser device renders audio.
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
        playbackStatus.epoch,
        playbackStatus.revision ?? 0,
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
    if (playbackStatus.epoch !== lastEpochRef.current) {
      lastEpochRef.current = playbackStatus.epoch;
      lastSeekSeqRef.current = playbackStatus.seekSeq ?? 0;
      return;
    }
    const seq = playbackStatus.seekSeq ?? 0;
    if (seq === lastSeekSeqRef.current) return;
    lastSeekSeqRef.current = seq;
    seek(playbackStatus.elapsed);
  }, [
    isActiveBrowser,
    playbackStatus.seekSeq,
    playbackStatus.elapsed,
    playbackStatus.state,
    playbackStatus.epoch,
    seek,
  ]);

  useEffect(() => {
    setCrossfade(playbackStatus.crossfade ?? 0);
  }, [playbackStatus.crossfade, setCrossfade]);

  // Apply the browser-local preference immediately. This is what prevents the
  // initial 0 -> server-default volume jump while the first status arrives.
  useEffect(() => {
    setEngineVolume(volumePreference.effectiveVolume);
  }, [volumePreference.effectiveVolume, setEngineVolume]);

  // A new active-device claim starts a new hydration cycle.
  useEffect(() => {
    if (isActiveBrowser) return;
    initialPushStartedRef.current = false;
    initialPushDoneRef.current = false;
  }, [isActiveBrowser]);

  // Push the stored browser preference once when this device becomes active.
  // The server volume is shared, but this browser's local preference should win
  // at startup; later remote changes are applied by the effect below.
  useEffect(() => {
    if (!isActiveBrowser || initialPushStartedRef.current) return;
    initialPushStartedRef.current = true;

    if (!volumePreference.hasStoredPreference) {
      volumePreference.applyServerVolume(playbackStatus.volume);
      initialPushDoneRef.current = true;
      return;
    }

    const volumeToPush = volumePreference.muted
      ? volumePreference.lastVolume
      : volumePreference.volume;
    lastPushedVolumeRef.current = volumeToPush;
    void persistVolume(volumeToPush)
      .then(applyPlaybackStatus)
      .catch(() => toast.error(t("player.volumeError")))
      .finally(() => {
        initialPushDoneRef.current = true;
      });
  }, [
    isActiveBrowser,
    volumePreference.hasStoredPreference,
    volumePreference.muted,
    volumePreference.lastVolume,
    volumePreference.volume,
    volumePreference.applyServerVolume,
    playbackStatus.volume,
    applyPlaybackStatus,
    t,
  ]);

  // Once hydration is complete, follow volume changes made by other devices.
  // Mute stays local: while muted the engine stays at 0 but lastVolume follows
  // the shared value so unmuting restores the latest volume.
  useEffect(() => {
    if (!isActiveBrowser || !initialPushDoneRef.current) return;
    const serverVolume = playbackStatus.volume;
    if (serverVolume === lastPushedVolumeRef.current) return;
    volumePreference.applyServerVolume(serverVolume);
  }, [
    isActiveBrowser,
    playbackStatus.volume,
    volumePreference.applyServerVolume,
  ]);

  const scheduleVolumePersist = useCallback(
    (value: number) => {
      if (!isActiveBrowser) return;
      lastPushedVolumeRef.current = value;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        void persistVolume(value)
          .then(applyPlaybackStatus)
          .catch(() => toast.error(t("player.volumeError")));
      }, 250);
    },
    [isActiveBrowser, applyPlaybackStatus, t],
  );

  const handleVolumeChange = useCallback(
    (value: number) => {
      volumePreference.setVolume(value);
      scheduleVolumePersist(value);
    },
    [volumePreference.setVolume, scheduleVolumePersist],
  );

  const handleToggleMute = useCallback(() => {
    volumePreference.toggleMute();
  }, [volumePreference.toggleMute]);

  const handleResetVolume = useCallback(() => {
    volumePreference.resetVolume();
    scheduleVolumePersist(DEFAULT_VOLUME);
  }, [volumePreference.resetVolume, scheduleVolumePersist]);

  useEffect(
    () => () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    },
    [],
  );

  // Preload the upcoming track on the standby deck so the transition is
  // instant and the backend can expose nextTrackId ahead of time.
  useEffect(() => {
    if (!isActiveBrowser) return;
    const nextId = playbackStatus.nextTrackId;
    const currentId = playbackStatus.track?.id;
    if (nextId && nextId !== currentId) {
      preloadTrack(nextId, `/stream/${nextId}`);
    } else {
      clearPreload();
    }
  }, [
    isActiveBrowser,
    playbackStatus.nextTrackId,
    playbackStatus.track?.id,
    preloadTrack,
    clearPreload,
  ]);

  // Track change detection feeds the shared "now playing" track. The context
  // derives trackPlayed from playbackStatus.track, so a stopped, empty queue
  // automatically clears it and the mobile player shows its empty state.

  // The active browser reads the real audio clock; only passive/MPD devices
  // need to interpolate between server updates.
  useEffect(() => {
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

  const value = useMemo(
    () => ({
      isActiveBrowser,
      displayElapsed,
      autoplayBlocked,
      volume: volumePreference.effectiveVolume,
      muted: volumePreference.muted,
      setVolume: handleVolumeChange,
      toggleMute: handleToggleMute,
      resetVolume: handleResetVolume,
      play,
    }),
    [
      isActiveBrowser,
      displayElapsed,
      autoplayBlocked,
      volumePreference.effectiveVolume,
      volumePreference.muted,
      handleVolumeChange,
      handleToggleMute,
      handleResetVolume,
      play,
    ],
  );

  return (
    <PlayerEngineContext.Provider value={value}>
      {children}
    </PlayerEngineContext.Provider>
  );
}
