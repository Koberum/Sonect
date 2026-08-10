import { useEffect, useRef } from "react";
import { usePlaybackContext, type SyncProgress } from "./playback-context";
import type { PlaybackStatus } from "@repo/types";

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { setPlaybackStatus, setTrackPlayed, setSyncProgress, setWsConnected } =
    usePlaybackContext();

  const settersRef = useRef({
    setPlaybackStatus,
    setTrackPlayed,
    setSyncProgress,
    setWsConnected,
  });
  useEffect(() => {
    settersRef.current = {
      setPlaybackStatus,
      setTrackPlayed,
      setSyncProgress,
      setWsConnected,
    };
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalCloseRef = useRef(false);
  const trackIdRef = useRef<number | null>(null);

  const wsUrl =
    import.meta.env.VITE_WEBSOCKET_URL ||
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

  useEffect(() => {
    const {
      setPlaybackStatus,
      setTrackPlayed,
      setSyncProgress,
      setWsConnected,
    } = settersRef.current;

    intentionalCloseRef.current = false;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      wsRef.current?.close();

      const ws = new WebSocket(wsUrl);
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
            const pd = data as unknown as PlaybackStatus;

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
            });

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
  }, [wsUrl]);

  return <>{children}</>;
}
