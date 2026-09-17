import { useEffect, useRef } from "react";
import { getProfileSessionId } from "@/lib/selectedProfile";
import { useProfile } from "@/features/profiles/profile-context";
import { usePlaybackContext, type SyncProgress } from "./playback-context";
import { defaultPlayerState } from "@/lib/playbackState";
import type { PlaybackStatus } from "@repo/types";
import { getDeviceId, getDeviceName, getDeviceType } from "@/lib/deviceId";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const {
    setPlaybackStatus,
    setTrackPlayed,
    setSyncProgress,
    setWsConnected,
    setActiveDeviceId,
    setActiveDeviceName,
    setActiveDeviceType,
  } = usePlaybackContext();

  const settersRef = useRef({
    setPlaybackStatus,
    setTrackPlayed,
    setSyncProgress,
    setWsConnected,
    setActiveDeviceId,
    setActiveDeviceName,
    setActiveDeviceType,
  });
  useEffect(() => {
    settersRef.current = {
      setPlaybackStatus,
      setTrackPlayed,
      setSyncProgress,
      setWsConnected,
      setActiveDeviceId,
      setActiveDeviceName,
      setActiveDeviceType,
    };
  });

  const wsRef = useRef<WebSocket | null>(null);
  const trackIdRef = useRef<number | null>(null);

  const { profile } = useProfile();
  const profileId = profile?.id ?? getProfileSessionId();

  const wsUrl: string =
    import.meta.env.VITE_WEBSOCKET_URL ||
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

  useEffect(() => {
    const {
      setPlaybackStatus,
      setTrackPlayed,
      setSyncProgress,
      setWsConnected,
      setActiveDeviceId,
      setActiveDeviceName,
      setActiveDeviceType,
    } = settersRef.current;

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

      const sid = profileId || getProfileSessionId();
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
            setSyncProgress(data as unknown as SyncProgress);
            return;
          }

          if (type === "sync-complete") {
            setSyncProgress(null);
            return;
          }

          if (type === "sync-error") {
            setSyncProgress(null);
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

            setPlaybackStatus({
              track: pd.track,
              elapsed: pd.elapsed,
              duration: pd.duration,
              state: pd.state,
              volume: pd.volume,
              repeat: pd.repeat,
              random: pd.random,
              single: pd.single,
              consume: pd.consume,
              queueLength: pd.queueLength ?? 0,
              activeDeviceId: pd.activeDeviceId ?? null,
              activeDeviceName: pd.activeDeviceName ?? null,
              activeDeviceType: pd.activeDeviceType ?? null,
              mode: (pd as unknown as { mode?: string })
                .mode as PlaybackStatus["mode"],
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

      nextWs.onclose = () => {
        if (ws !== nextWs) return;
        if (wsRef.current === nextWs) wsRef.current = null;
        if (cancelled) return;
        setWsConnected(false);
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
  }, [wsUrl, profileId]);

  return <>{children}</>;
}
