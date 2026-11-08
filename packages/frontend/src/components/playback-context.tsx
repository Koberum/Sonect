// MusicContext.tsx
import type { PlaybackStatus, OutputMode } from "@repo/types";
import type {
  LibrarySyncProgress,
  TrackWithRelations,
} from "@repo/types/catalog";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/auth-context";
import { playerQueries } from "@/features/player/queries";
import { getDeviceId, getDeviceName, getDeviceType } from "@/lib/deviceId";
import { defaultPlayerState } from "@/lib/playbackState";

export type SyncProgress = LibrarySyncProgress;

type RouterStatus = Pick<
  PlaybackStatus,
  "activeDeviceId" | "activeDeviceName" | "activeDeviceType" | "mode"
>;

type PlaybackContextType = {
  playbackStatus: PlaybackStatus;
  trackPlayed: TrackWithRelations | null;
  syncProgress: SyncProgress | null;
  syncError: string | null;
  wsConnected: boolean;
  applyPlaybackStatus: (status: PlaybackStatus) => void;
  applyRouterStatus: (status: RouterStatus) => void;
  setSyncProgress: (progress: SyncProgress | null) => void;
  setSyncError: (error: string | null) => void;
  outputMode: OutputMode;
  setOutputMode: (mode: OutputMode) => void;
  activeDeviceId: string | null;
  activeDeviceName: string | null;
  activeDeviceType: string | null;
  myDeviceId: string;
  myDeviceName: string;
  myDeviceType: string;
  setWsConnected: (connected: boolean) => void;
};

const PlaybackContext = createContext<PlaybackContextType | undefined>(
  undefined,
);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [playbackStatus, setPlaybackStatus] =
    useState<PlaybackStatus>(defaultPlayerState);
  const lastStatusRef = useRef<{ epoch?: string; revision?: number }>({});
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [outputMode, setOutputMode] = useState<OutputMode>(() => {
    if (typeof window === "undefined") return "browser";
    const v = localStorage.getItem("outputMode");
    return v === "browser" || v === "mpd" ? v : "browser";
  });
  const [myDeviceId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return getDeviceId();
  });
  const [myDeviceName] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return getDeviceName();
  });
  const [myDeviceType] = useState<string>(() => {
    if (typeof window === "undefined") return "desktop";
    return getDeviceType();
  });
  const { isAuthenticated, profile } = useAuth();
  const profileId = profile?.id ?? "";
  const { data: outputModeData } = useQuery({
    ...playerQueries.outputMode(profileId),
    enabled: isAuthenticated && !!profileId,
  });
  const hydratedModeRef = useRef(false);
  const [lastTrack, setLastTrack] = useState<TrackWithRelations | null>(null);

  useEffect(() => {
    localStorage.setItem("outputMode", outputMode);
  }, [outputMode]);

  // Re-hydrate the mode for each profile (the query is cleared on switch).
  useEffect(() => {
    hydratedModeRef.current = false;
  }, [profile?.id]);

  // Hydrate the mode from REST once, so a fresh browser knows the backend's
  // per-profile mode before the first WebSocket status arrives.
  useEffect(() => {
    if (hydratedModeRef.current || !outputModeData?.mode) return;
    hydratedModeRef.current = true;
    setOutputMode(outputModeData.mode);
  }, [outputModeData?.mode]);

  // Keep the last known track while a transient status omits it (for example a
  // failed MPD currentsong read). A stop clears it.
  useEffect(() => {
    if (playbackStatus.track) {
      setLastTrack(playbackStatus.track);
    } else if (playbackStatus.state === "stop") {
      setLastTrack(null);
    }
  }, [playbackStatus.track, playbackStatus.state]);

  // Statuses can arrive from the WS broadcast and from command responses.
  // Apply them in (epoch, revision) order so a slower response cannot roll
  // playback back to an older state.
  const applyPlaybackStatus = useCallback((status: PlaybackStatus) => {
    if (status.epoch !== undefined && status.revision !== undefined) {
      const previous = lastStatusRef.current;
      if (
        previous.epoch === status.epoch &&
        previous.revision !== undefined &&
        status.revision <= previous.revision
      ) {
        return;
      }
      lastStatusRef.current = {
        epoch: status.epoch,
        revision: status.revision,
      };
    }
    setPlaybackStatus(status);
  }, []);

  // Router-owned fields change without an engine revision bump (browser output
  // handoff, active-device release), so they must bypass the revision dedupe.
  const applyRouterStatus = useCallback((status: RouterStatus) => {
    setPlaybackStatus((previous) => {
      const next: PlaybackStatus = {
        ...previous,
        activeDeviceId:
          status.activeDeviceId === undefined
            ? previous.activeDeviceId
            : status.activeDeviceId,
        activeDeviceName:
          status.activeDeviceName === undefined
            ? previous.activeDeviceName
            : status.activeDeviceName,
        activeDeviceType:
          status.activeDeviceType === undefined
            ? previous.activeDeviceType
            : status.activeDeviceType,
        mode:
          status.mode === "browser" || status.mode === "mpd"
            ? status.mode
            : previous.mode,
      };

      if (
        next.activeDeviceId === previous.activeDeviceId &&
        next.activeDeviceName === previous.activeDeviceName &&
        next.activeDeviceType === previous.activeDeviceType &&
        next.mode === previous.mode
      ) {
        return previous;
      }
      return next;
    });
  }, []);

  // Everything below is derived from the single status object; there is no
  // second copy to keep in sync with the backend.
  const trackPlayed =
    playbackStatus.track ??
    (playbackStatus.state === "stop" ? null : lastTrack);
  const activeDeviceId = playbackStatus.activeDeviceId ?? null;
  const activeDeviceName = playbackStatus.activeDeviceName ?? null;
  const activeDeviceType = playbackStatus.activeDeviceType ?? null;

  const value = useMemo<PlaybackContextType>(
    () => ({
      playbackStatus,
      trackPlayed,
      applyPlaybackStatus,
      applyRouterStatus,
      syncProgress,
      syncError,
      wsConnected,
      setSyncProgress,
      setSyncError,
      outputMode,
      setOutputMode,
      activeDeviceId,
      activeDeviceName,
      activeDeviceType,
      myDeviceId,
      myDeviceName,
      myDeviceType,
      setWsConnected,
    }),
    [
      playbackStatus,
      trackPlayed,
      applyPlaybackStatus,
      applyRouterStatus,
      syncProgress,
      syncError,
      wsConnected,
      outputMode,
      activeDeviceId,
      activeDeviceName,
      activeDeviceType,
      myDeviceId,
      myDeviceName,
      myDeviceType,
    ],
  );

  return (
    <PlaybackContext.Provider value={value}>
      {children}
    </PlaybackContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePlaybackContext() {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error("usePlaybackContext must be used inside PlaybackProvider");
  }
  return context;
}
