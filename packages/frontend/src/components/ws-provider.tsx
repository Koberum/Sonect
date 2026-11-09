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
import { PlayerReportBuffer } from "@/lib/playerReportBuffer";
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
    applyPlaybackStatus,
    applyRouterStatus,
    setSyncProgress,
    setSyncError,
    setWsConnected,
    setOutputMode,
  } = usePlaybackContext();

  const wsRef = useRef<WebSocket | null>(null);
  const reportBufferRef = useRef(new PlayerReportBuffer());

  const sendReport = useCallback((report: PlayerReport) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      reportBufferRef.current.push(report);
      return;
    }
    try {
      ws.send(JSON.stringify({ type: "player-report", ...report }));
    } catch {
      // The socket may close between the check and the send; keep the fact
      // for the next connection instead of losing the transition.
      reportBufferRef.current.push(report);
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

    let lastSyncInvalidationKey: string | null = null;

    // Report facts belong to the profile that produced them; never replay them
    // into another profile's socket.
    reportBufferRef.current.clear();

    // Guard: each profile gets its own isolated socket. Tear down any previous
    // socket *before* opening the new one so we never have two live streams
    // writing into the single PlaybackContext (which caused interleaved song flicker).
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;

    // Reset per-profile UI state immediately so the old profile's track doesn't
    // linger while the new one connects.
    applyPlaybackStatus(defaultPlayerState);
    setSyncProgress(null);
    setSyncError(null);
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

        const pending = reportBufferRef.current.drain();
        for (let index = 0; index < pending.length; index += 1) {
          try {
            nextWs.send(
              JSON.stringify({ type: "player-report", ...pending[index] }),
            );
          } catch {
            for (const report of pending.slice(index)) {
              reportBufferRef.current.push(report);
            }
            break;
          }
        }
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
            const status = data as unknown as PlaybackStatus;
            applyPlaybackStatus({ ...defaultPlayerState, ...status });
            applyRouterStatus(status);
            if (status.mode === "browser" || status.mode === "mpd") {
              setOutputMode(status.mode);
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
  }, [
    wsUrl,
    profileId,
    queryClient,
    applyPlaybackStatus,
    applyRouterStatus,
    setSyncProgress,
    setSyncError,
    setWsConnected,
    setOutputMode,
  ]);

  return (
    <PlayerSocketContext.Provider value={socketValue}>
      {children}
    </PlayerSocketContext.Provider>
  );
}
