import { useCallback, useEffect, useRef, useState } from "react";

export type BrowserAudioState =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "ended"
  | "error";

interface UseBrowserAudioReturn {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (vol: number) => void;
  state: BrowserAudioState;
  currentTime: number;
  duration: number;
  volume: number;
  loadTrack: (src: string, startTime?: number) => void;
  autoplayBlocked: boolean;
}

export function useBrowserAudio(): UseBrowserAudioReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const autoplayBlockedRef = useRef(false);
  const [state, setState] = useState<BrowserAudioState>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audioRef.current = audio;

    const onPlay = () => setState("playing");
    const onPause = () => setState("paused");
    const onEnded = () => setState("ended");
    const onError = () => setState("error");
    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setState("loading");
      if (pendingSeekRef.current !== null) {
        audio.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      }
    };
    const onCanPlay = () => {
      if (!audio.paused) setState("playing");
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      audio.pause();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!autoplayBlockedRef.current) return;
      autoplayBlockedRef.current = false;
      setAutoplayBlocked(false);
      audioRef.current?.play().catch(() => {});
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  const loadTrack = useCallback((src: string, startTime?: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    setState("loading");
    audio.src = src;
    if (startTime !== undefined) {
      pendingSeekRef.current = startTime;
    }
    audio.load();
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch((err: unknown) => {
      if ((err as DOMException)?.name === "NotAllowedError") {
        autoplayBlockedRef.current = true;
        setAutoplayBlocked(true);
      }
    });
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, vol / 100));
    }
    setVolumeState(vol);
  }, []);

  return {
    play,
    pause,
    seek,
    setVolume,
    state,
    currentTime,
    duration,
    volume,
    loadTrack,
    autoplayBlocked,
  };
}
