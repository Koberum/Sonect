import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerReport } from "@repo/types";
import {
  BrowserAudioEngine,
  type BrowserAudioEngineCallbacks,
  type BrowserAudioState,
} from "./browserAudioEngine";

export type { BrowserAudioState };

interface UseBrowserAudioOptions {
  onReport?: (report: PlayerReport) => void;
  onError?: (message: string) => void;
}

interface UseBrowserAudioReturn {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  startTrack: (
    trackId: number,
    src: string,
    startAt?: number,
    commandSeq?: number,
  ) => void;
  preloadTrack: (trackId: number, src: string) => void;
  state: BrowserAudioState;
  currentTime: number;
  duration: number;
  volume: number;
  error: string | null;
  autoplayBlocked: boolean;
}

export function useBrowserAudio(
  options: UseBrowserAudioOptions = {},
): UseBrowserAudioReturn {
  const engineRef = useRef<BrowserAudioEngine | null>(null);
  const optionsRef = useRef(options);
  const [state, setState] = useState<BrowserAudioState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    const callbacks: BrowserAudioEngineCallbacks = {
      onStateChange: setState,
      onProgress: (time, total) => {
        setCurrentTime(time);
        setDuration(total);
      },
      onReport: (report) => optionsRef.current.onReport?.(report),
      onError: (message) => {
        setError(message);
        optionsRef.current.onError?.(message);
      },
      onAutoplayBlocked: setAutoplayBlocked,
    };
    const engine = new BrowserAudioEngine(callbacks);
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!autoplayBlocked) return;
    const handler = () => {
      engineRef.current?.play();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [autoplayBlocked]);

  const play = useCallback(() => {
    engineRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    engineRef.current?.seek(time);
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    engineRef.current?.setVolume(vol);
  }, []);

  const startTrack = useCallback(
    (trackId: number, src: string, startAt = 0, commandSeq?: number) => {
      setError(null);
      engineRef.current?.startTrack(trackId, src, startAt, commandSeq);
    },
    [],
  );

  const preloadTrack = useCallback((trackId: number, src: string) => {
    engineRef.current?.preloadTrack(trackId, src);
  }, []);

  return useMemo(
    () => ({
      play,
      pause,
      seek,
      setVolume,
      startTrack,
      preloadTrack,
      state,
      currentTime,
      duration,
      volume,
      error,
      autoplayBlocked,
    }),
    [
      play,
      pause,
      seek,
      setVolume,
      startTrack,
      preloadTrack,
      state,
      currentTime,
      duration,
      volume,
      error,
      autoplayBlocked,
    ],
  );
}
