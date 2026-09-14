// MusicContext.tsx
import type { PlaybackStatus, OutputMode } from "@repo/types";
import type { TrackWithRelations } from "@repo/types/catalog";
import { createContext, useContext, useEffect, useState } from "react";
import { getOutputMode } from "@/features/player/api";
import { getDeviceId, getDeviceName, getDeviceType } from "@/lib/deviceId";

export type SyncProgress = {
  current: number;
  total: number;
  phase?: "scan-started" | "mpd" | "tracks" | "covers";
  track: {
    title: string;
    artist: string;
    album: string;
  } | null;
};

type PlaybackContextType = {
  trackPlayed: TrackWithRelations | null;
  playbackStatus: PlaybackStatus;
  syncProgress: SyncProgress | null;
  wsConnected: boolean;
  setTrackPlayed: (track: TrackWithRelations | null) => void;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  setSyncProgress: (progress: SyncProgress | null) => void;
  outputMode: OutputMode;
  setOutputMode: (mode: OutputMode) => void;
  activeDeviceId: string | null;
  activeDeviceName: string | null;
  activeDeviceType: string | null;
  myDeviceId: string;
  myDeviceName: string;
  myDeviceType: string;
  setActiveDeviceId: (id: string | null) => void;
  setActiveDeviceName: (name: string | null) => void;
  setActiveDeviceType: (type: string | null) => void;
  setWsConnected: (connected: boolean) => void;
};

const PlaybackContext = createContext<PlaybackContextType | undefined>(
  undefined,
);

const defaultPlayerState: PlaybackStatus = {
  elapsed: 0,
  duration: 0,
  volume: 0,
  repeat: false,
  random: false,
  single: false,
  consume: false,
  state: "stop",
  queueLength: 0,
};

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const [trackPlayed, setTrackPlayed] = useState<TrackWithRelations | null>(
    null,
  );
  const [playbackStatus, setPlaybackStatus] =
    useState<PlaybackStatus>(defaultPlayerState);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [outputMode, setOutputMode] = useState<OutputMode>(() => {
    if (typeof window === "undefined") return "mpd";
    const v = localStorage.getItem("outputMode");
    return v === "browser" || v === "mpd" ? v : "mpd";
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
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [activeDeviceName, setActiveDeviceName] = useState<string | null>(null);
  const [activeDeviceType, setActiveDeviceType] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("outputMode", outputMode);
  }, [outputMode]);

  // Hydrate outputMode + activeDevice from backend (per-profile, PlayerRouter default browser).
  // Backend is source of truth; localStorage is only a fallback.
  useEffect(() => {
    let cancelled = false;
    getOutputMode()
      .then((res) => {
        if (cancelled) return;
        if (
          (res.mode === "browser" || res.mode === "mpd") &&
          res.mode !== outputMode
        ) {
          setOutputMode(res.mode);
        }
        if ("activeDeviceId" in res && res.activeDeviceId !== undefined) {
          setActiveDeviceId(res.activeDeviceId ?? null);
        }
        if ("activeDeviceName" in res && res.activeDeviceName !== undefined) {
          setActiveDeviceName(res.activeDeviceName ?? null);
        }
        if ("activeDeviceType" in res && res.activeDeviceType !== undefined) {
          setActiveDeviceType(res.activeDeviceType ?? null);
        }
      })
      .catch(() => {
        // keep localStorage fallback
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PlaybackContext.Provider
      value={{
        trackPlayed,
        playbackStatus,
        syncProgress,
        wsConnected,
        setTrackPlayed,
        setPlaybackStatus,
        setSyncProgress,
        outputMode,
        setOutputMode,
        activeDeviceId,
        activeDeviceName,
        activeDeviceType,
        myDeviceId,
        myDeviceName,
        myDeviceType,
        setActiveDeviceId,
        setActiveDeviceName,
        setActiveDeviceType,
        setWsConnected,
      }}
    >
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
