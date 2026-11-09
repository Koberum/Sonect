import { useEffect, useState } from "react";

/**
 * Avoids flashing a reconnecting state during the initial WebSocket handshake:
 * the disconnect is reported only after it has lasted for `delayMs`.
 */
export function useDelayedDisconnect(
  connected: boolean,
  delayMs: number,
): boolean {
  const [disconnected, setDisconnected] = useState(false);

  useEffect(() => {
    if (connected) {
      setDisconnected(false);
      return;
    }
    const timer = setTimeout(() => setDisconnected(true), delayMs);
    return () => clearTimeout(timer);
  }, [connected, delayMs]);

  return disconnected;
}
