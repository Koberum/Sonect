import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "@/features/auth/auth-context";
import { usePlaybackContext, type SyncProgress } from "./playback-context";
import { defaultPlayerState } from "@/lib/playbackState";
import type { PlaybackStatus, PlayerReport } from "@repo/types";
import { getDeviceId, getDeviceName, getDeviceType } from "@/lib/deviceId";
import { useQueryClient } from "@tanstack/react-query";
import {
  invalidateCatalogAfterSync,
  invalidateSystemAfterSync,
} from "@/features/sync/sync-invalidation";
import i18n from "@/i18n/config";
import { toast } from "sonner";

type PlayerSocketContextValue = {
  sendReport: (report: PlayerReport) => void;
};

const PlayerSocketContext = createContext<PlayerSocketContextValue | null>(
  null,
);

// eslint-disable-next-line react-refresh/only-export-components
export function usePlayerSocket(): PlayerSocketContextValue {
  const value = useContext(PlayerSocketContext);
  if (!value) {
    throw new Error("usePlayerSocket must be used inside WebSocketProvider");
  }
  return value;
}

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const {
    setPlaybackStatus,
    applyPlaybackStatus,
    setTrackPlayed,
    setSyncProgress,
    setSyncError,
    setWsConnected,
    setActiveDeviceId,
    setActiveDeviceName,
    setActiveDeviceType,
    setOutputMode,
  } = usePlaybackContext();

  const settersRef = useRef({
    setPlaybackStatus,
    applyPlaybackStatus,
    setTrackPlayed,
    setSyncProgress,
    setSyncError,
    setWsConnected,
    setActiveDeviceId,
    setActiveDeviceName,
    setActiveDeviceType,
    setOutputMode,
  });
  useEffect(() => {
    settersRef.current = {
      setPlaybackStatus,
      applyPlaybackStatus,
      setTrackPlayed,
      setSyncProgress,
      setSyncError,
      setWsConnected,
      setActiveDeviceId,
      setActiveDeviceName,
      setActiveDeviceType,
      setOutputMode,
    };
  });

  const wsRef = useRef<WebSocket | null>(null);
  const trackIdRef = useRef<number | null>(null);

  const sendReport = useCallback((report: PlayerReport) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      ws.send(JSON.stringify({ type: "player-report", ...report }));
    } catch {
      // socket may close between the check and the send
    }
  }, []);
  const socketValue = useMemo(() => ({ sendReport }), [sendReport]);

  const { profile, isAdmin } = useAuth();
  const profileId = profile?.id ?? "";
  const isAdminRef = useRef(isAdmin);
  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);
  const queryClient = useQueryClient();

  const wsUrl: string =
    import.meta.env.VITE_WEBSOCKET_URL ||
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

  useEffect(() => {
    if (!profileId) return;

    const {
      setPlaybackStatus,
      applyPlaybackStatus,
      setTrackPlayed,
      setSyncProgress,
      setSyncError,
      setWsConnected,
      setActiveDeviceId,
      setActiveDeviceName,
      setActiveDeviceType,
      setOutputMode,
    } = settersRef.current;
    let lastSyncInvalidationKey: string | null = null;

    // Guard: each profile gets its own isolated socket. Tear down any previous
    // socket *before* opening the new one so we never have two live streams
    // writing into the single PlaybackContext (which caused interleaved song flicker).
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;

    // Reset per-profile UI state immediately so the old profile's track doesn't
    // linger while the new one connects.
    trackIdRef.current = null;
    setPlaybackStatus(defaultPlayerState);
    setTrackPlayed(null);
    setSyncProgress(null);
    setSyncError(null);
    setActiveDeviceId(null);
    setActiveDeviceName(null);
    setActiveDeviceType(null);
    setWsConnected(false);

    // Ensure any socket left in wsRef (rare race) is fully detached.
    if (wsRef.current) {
      const prev = wsRef.current;
      prev.onopen = null;
      prev.onmessage = null;
      prev.onclose = null;
      prev.onerror = null;
      try {
        prev.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }

    const connect = () => {
      if (cancelled) return;

      // Detach previous ws instance owned by this effect before replacing it.
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }

      const sid = profileId;
      const did = getDeviceId();
      const dName = getDeviceName();
      const dType = getDeviceType();
      const sessionUrl = `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}sessionId=${encodeURIComponent(sid)}&deviceId=${encodeURIComponent(did)}&deviceName=${encodeURIComponent(dName)}&deviceType=${encodeURIComponent(dType)}`;
      const nextWs = new WebSocket(sessionUrl);
      ws = nextWs;
      wsRef.current = nextWs;

      nextWs.onopen = () => {
        if (cancelled || ws !== nextWs) {
          try {
            nextWs.close();
          } catch {
            /* ignore */
          }
          return;
        }
        setWsConnected(true);
        reconnectAttempt = 0;
      };

      nextWs.onmessage = (event) => {
        if (cancelled || ws !== nextWs) return;
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          const type = data.type as string | undefined;

          if (type === "sync-progress") {
            const progress = data as unknown as SyncProgress;
            setSyncProgress(progress);
            setSyncError(null);

            const tracksSettled =
              progress.phase === "tracks" &&
              progress.total > 0 &&
              progress.current >= progress.total;
            const invalidationKey =
              progress.phase === "covers" || tracksSettled
                ? progress.phase
                : null;
            if (
              invalidationKey !== null &&
              invalidationKey !== lastSyncInvalidationKey
            ) {
              lastSyncInvalidationKey = invalidationKey;
              invalidateCatalogAfterSync(queryClient);
            }
            return;
          }

          if (type === "sync-complete") {
            setSyncProgress(null);
            setSyncError(null);
            invalidateSystemAfterSync(queryClient);
            if (isAdminRef.current) {
              toast.success(i18n.t("sync.complete"));
            }
            return;
          }

          if (type === "sync-error") {
            const message =
              typeof data.message === "string" && data.message
                ? data.message
                : i18n.t("sync.failed");
            setSyncProgress(null);
            setSyncError(message);
            if (isAdminRef.current) {
              toast.error(i18n.t("sync.failed"), { description: message });
            }
            return;
          }

          if (type === "log") {
            // strictly for debug — not wired to sync badge
            return;
          }

          if (type === "player-status" || type === undefined) {
            const pd = data as unknown as PlaybackStatus & {
              activeDeviceId?: string | null;
              activeDeviceName?: string | null;
              activeDeviceType?: string | null;
            };

            applyPlaybackStatus({
              track: pd.track,
              elapsed: pd.elapsed,
              duration: pd.duration,
              state: pd.state,
              volume: pd.volume,
              repeat: pd.repeat,
              random: pd.random,
              single: pd.single,
              consume: pd.consume,
              error: pd.error ?? null,
              queueLength: pd.queueLength ?? 0,
              activeDeviceId: pd.activeDeviceId ?? null,
              activeDeviceName: pd.activeDeviceName ?? null,
              activeDeviceType: pd.activeDeviceType ?? null,
              mode: (pd as unknown as { mode?: string })
                .mode as PlaybackStatus["mode"],
              nextTrackId: pd.nextTrackId ?? null,
              buffering: pd.buffering ?? false,
              seekSeq: pd.seekSeq ?? 0,
              crossfade: pd.crossfade ?? 0,
              epoch: pd.epoch,
              revision: pd.revision,
            });
            if ("activeDeviceId" in pd) {
              setActiveDeviceId(pd.activeDeviceId ?? null);
            }
            if ("activeDeviceName" in pd) {
              setActiveDeviceName(pd.activeDeviceName ?? null);
            }
            if ("activeDeviceType" in pd) {
              setActiveDeviceType(pd.activeDeviceType ?? null);
            }
            if (pd.mode === "browser" || pd.mode === "mpd") {
              setOutputMode(pd.mode);
            }

            if (pd.track && trackIdRef.current !== pd.track.id) {
              trackIdRef.current = pd.track.id;
              setTrackPlayed(pd.track);
            }
            return;
          }
        } catch {
          /* ignore malformed messages */
        }
      };

      nextWs.onclose = (event) => {
        if (ws !== nextWs) return;
        if (wsRef.current === nextWs) wsRef.current = null;
        if (cancelled) return;
        setWsConnected(false);
        if (event.code === 4401 || event.code === 4403) {
          window.dispatchEvent(new Event("sonect:unauthorized"));
          return;
        }
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
        reconnectAttempt++;
        reconnectTimer = setTimeout(() => {
          if (!cancelled) connect();
        }, delay);
      };

      nextWs.onerror = () => {};
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        if (wsRef.current === ws) wsRef.current = null;
      }
      setWsConnected(false);
    };
  }, [wsUrl, profileId, queryClient]);

  return (
    <PlayerSocketContext.Provider value={socketValue}>
      {children}
    </PlayerSocketContext.Provider>
  );
}
