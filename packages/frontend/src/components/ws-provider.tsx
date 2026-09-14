import { useEffect, useRef } from "react";
import { getProfileSessionId } from "@/lib/selectedProfile";
import { useProfile } from "@/features/profiles/profile-context";
import { usePlaybackContext, type SyncProgress } from "./playback-context";
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
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
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

    intentionalCloseRef.current = false;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      wsRef.current?.close();

      const sid = profileId || getProfileSessionId();
      const did = getDeviceId();
      const dName = getDeviceName();
      const dType = getDeviceType();
      const sessionUrl = `${wsUrl}${wsUrl.includes("?") ? "&" : "?"}sessionId=${encodeURIComponent(sid)}&deviceId=${encodeURIComponent(did)}&deviceName=${encodeURIComponent(dName)}&deviceType=${encodeURIComponent(dType)}`;
      const ws = new WebSocket(sessionUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) {
          ws.close();
          return;
        }
        setWsConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
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

      ws.onclose = () => {
        wsRef.current = null;
        if (cancelled) return;
        setWsConnected(false);
        if (!intentionalCloseRef.current) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptRef.current),
            30000,
          );
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(() => {
            if (!cancelled) connect();
          }, delay);
        }
      };

      ws.onerror = () => {};
    };

    connect();

    return () => {
      cancelled = true;
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      wsRef.current = null;
      setWsConnected(false);
    };
  }, [wsUrl, profileId]);

  return <>{children}</>;
}
