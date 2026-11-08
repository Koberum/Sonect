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
import { getDeviceId, getDeviceName, getDeviceType } from "@/lib/deviceId";
import { defaultPlayerState } from "@/lib/playbackState";

export type SyncProgress = LibrarySyncProgress;

type PlaybackContextType = {
  playbackStatus: PlaybackStatus;
  trackPlayed: TrackWithRelations | null;
  syncProgress: SyncProgress | null;
  syncError: string | null;
  wsConnected: boolean;
  applyPlaybackStatus: (status: PlaybackStatus) => void;
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

  useEffect(() => {
    localStorage.setItem("outputMode", outputMode);
  }, [outputMode]);

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

  // Everything below is derived from the single status object; there is no
  // second copy to keep in sync with the backend.
  const trackPlayed = playbackStatus.track ?? null;
  const activeDeviceId = playbackStatus.activeDeviceId ?? null;
  const activeDeviceName = playbackStatus.activeDeviceName ?? null;
  const activeDeviceType = playbackStatus.activeDeviceType ?? null;

  const value = useMemo<PlaybackContextType>(
    () => ({
      playbackStatus,
      trackPlayed,
      applyPlaybackStatus,
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
