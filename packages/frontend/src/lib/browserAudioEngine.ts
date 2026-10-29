import type { PlayerReport } from "@repo/types";

export type BrowserAudioState =
  "idle" | "loading" | "playing" | "paused" | "buffering" | "ended" | "error";

export type BrowserAudioEngineCallbacks = {
  onStateChange?: (state: BrowserAudioState) => void;
  onProgress?: (currentTime: number, duration: number) => void;
  onReport?: (report: PlayerReport) => void;
  onError?: (message: string) => void;
  onAutoplayBlocked?: (blocked: boolean) => void;
};

type DeckNodes = {
  source: MediaElementAudioSourceNode;
  gain: GainNode;
};

type Deck = {
  audio: HTMLAudioElement;
  trackId: number | null;
  src: string | null;
  pendingSeek: number | null;
  nodes: DeckNodes | null;
};

const REPORT_INTERVAL_MS = 1000;
const MAX_CROSSFADE_SECONDS = 30;

function createDeck(): Deck {
  const audio = new Audio();
  // Only fetch metadata until playback actually starts; the standby deck is
  // switched to `auto` when preloading the next track.
  audio.preload = "metadata";
  return {
    audio,
    trackId: null,
    src: null,
    pendingSeek: null,
    nodes: null,
  };
}

function isFiniteDuration(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function getAudioContextConstructor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  const target = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return target.AudioContext ?? target.webkitAudioContext ?? null;
}

/**
 * Browser playback engine.
 *
 * The browser is the source of truth for timing in browser mode. This engine
 * keeps two audio elements: the active one that is playing and a standby one
 * used to preload the next track. The UI reads `currentTime` from the active
 * element, and reports are sent to the backend so other devices can follow.
 *
 * When a crossfade is configured, both decks are routed through Web Audio
 * gain nodes so the end of one track can overlap the start of the next.
 */
export class BrowserAudioEngine {
  private active: Deck;
  private standby: Deck;
  private stateValue: BrowserAudioState = "idle";
  private currentTimeValue = 0;
  private durationValue = 0;
  private volumeValue = 100;
  private crossfadeSeconds = 0;
  private crossfading = false;
  private crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPreload: { trackId: number; src: string } | null = null;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private pendingPlay = false;
  private autoplayBlockedValue = false;
  private lastReportAt = 0;
  private lastCommandSeq = 0;
  private lastEndedTrackId: number | null = null;
  private advanceGuardUntil = 0;
  private destroyed = false;
  private readonly abort = new AbortController();
  private readonly callbacks: BrowserAudioEngineCallbacks;

  constructor(callbacks: BrowserAudioEngineCallbacks = {}) {
    this.callbacks = callbacks;
    this.active = createDeck();
    this.standby = createDeck();
    this.bindDeck(this.active);
    this.bindDeck(this.standby);
  }

  get state(): BrowserAudioState {
    return this.stateValue;
  }

  get currentTime(): number {
    return this.currentTimeValue;
  }

  get duration(): number {
    return this.durationValue;
  }

  get volume(): number {
    return this.volumeValue;
  }

  get autoplayBlocked(): boolean {
    return this.autoplayBlockedValue;
  }

  getTrackId(): number | null {
    return this.active.trackId;
  }

  setCrossfade(seconds: number): void {
    this.crossfadeSeconds = Math.max(
      0,
      Math.min(MAX_CROSSFADE_SECONDS, seconds),
    );
  }

  /**
   * Loads a track (if needed) and seeks it to `startAt`. If the standby deck
   * already has that track preloaded, it is promoted instead of refetching.
   */
  startTrack(
    trackId: number,
    src: string,
    startAt = 0,
    commandSeq = this.lastCommandSeq,
  ): void {
    if (this.destroyed) return;
    // After a local advance, ignore an in-flight status for the track that
    // just ended. A real command to go back to it bumps seekSeq on the server.
    if (
      Date.now() < this.advanceGuardUntil &&
      this.lastEndedTrackId === trackId &&
      commandSeq <= this.lastCommandSeq
    ) {
      return;
    }
    if (commandSeq < this.lastCommandSeq) return;
    this.lastCommandSeq = commandSeq;
    if (this.lastEndedTrackId === trackId) this.lastEndedTrackId = null;
    if (this.active.trackId === trackId) return;

    this.cancelCrossfade();
    if (this.standby.trackId === trackId) {
      this.promoteStandby(startAt);
      return;
    }

    this.loadDeck(this.active, trackId, src, startAt);
  }

  /**
   * Preloads the next track into the standby deck without playing it.
   */
  preloadTrack(trackId: number, src: string): void {
    if (this.destroyed) return;
    if (this.active.trackId === trackId) return;
    if (this.standby.trackId === trackId && this.standby.src === src) return;
    if (this.crossfading) {
      // The standby is still fading out; preload after the crossfade finishes.
      this.pendingPreload = { trackId, src };
      return;
    }
    this.loadDeck(this.standby, trackId, src, 0, false);
  }

  play(): void {
    if (this.destroyed) return;
    this.ensureAudioGraph();
    this.pendingPlay = true;
    this.playActive();
  }

  pause(): void {
    if (this.destroyed) return;
    this.cancelCrossfade();
    this.pendingPlay = false;
    const wasActive =
      !this.active.audio.paused ||
      this.stateValue === "playing" ||
      this.stateValue === "buffering";
    this.active.audio.pause();
    this.standby.audio.pause();
    this.setState("paused");
    if (wasActive) {
      this.report({
        state: "pause",
        elapsed: this.currentTimeValue,
        trackId: this.active.trackId ?? undefined,
      });
    }
  }

  seek(time: number): void {
    if (this.destroyed) return;
    this.cancelCrossfade();
    this.seekDeck(this.active, time);
    this.report({
      state: this.stateValue === "paused" ? "pause" : "play",
      elapsed: this.currentTimeValue,
      trackId: this.active.trackId ?? undefined,
    });
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(100, volume));
    this.volumeValue = clamped;
    const value = clamped / 100;
    if (this.masterGain && this.audioContext) {
      this.masterGain.gain.value = value;
    } else {
      this.active.audio.volume = value;
      this.standby.audio.volume = value;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort.abort();
    if (this.crossfadeTimer !== null) {
      clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    for (const deck of [this.active, this.standby]) {
      deck.audio.pause();
      deck.audio.removeAttribute("src");
      deck.audio.load();
    }
    if (this.audioContext) {
      void this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.masterGain = null;
    }
  }

  private bindDeck(deck: Deck): void {
    const { audio } = deck;
    const signal = this.abort.signal;

    audio.addEventListener(
      "loadstart",
      () => {
        if (!this.isActive(deck)) return;
        this.setState("loading");
      },
      { signal },
    );

    audio.addEventListener(
      "loadedmetadata",
      () => {
        if (!this.isActive(deck)) return;
        this.durationValue = isFiniteDuration(audio.duration)
          ? audio.duration
          : 0;
        if (deck.pendingSeek !== null) {
          const target = deck.pendingSeek;
          deck.pendingSeek = null;
          this.seekDeck(deck, target);
        }
        this.emitProgress();
      },
      { signal },
    );

    audio.addEventListener(
      "canplay",
      () => {
        if (!this.isActive(deck)) return;
        if (this.pendingPlay) this.playActive();
      },
      { signal },
    );

    audio.addEventListener(
      "playing",
      () => {
        if (!this.isActive(deck)) return;
        deck.pendingSeek = null;
        this.autoplayBlockedValue = false;
        this.callbacks.onAutoplayBlocked?.(false);
        this.setState("playing");
        this.report({
          event: "playing",
          state: "play",
          elapsed: this.currentTimeValue,
          trackId: this.active.trackId ?? undefined,
        });
        this.lastReportAt = Date.now();
        this.maybeStartCrossfade();
      },
      { signal },
    );

    audio.addEventListener(
      "waiting",
      () => {
        if (!this.isActive(deck)) return;
        this.setState("buffering");
        this.report({ event: "waiting" });
      },
      { signal },
    );

    audio.addEventListener(
      "timeupdate",
      () => {
        if (!this.isActive(deck)) return;
        this.currentTimeValue = audio.currentTime;
        this.emitProgress();
        this.maybeStartCrossfade();
        if (this.crossfading) return;
        if (
          this.stateValue === "playing" &&
          Date.now() - this.lastReportAt >= REPORT_INTERVAL_MS
        ) {
          this.lastReportAt = Date.now();
          this.report({
            state: "play",
            elapsed: this.currentTimeValue,
            trackId: this.active.trackId ?? undefined,
          });
        }
      },
      { signal },
    );

    audio.addEventListener(
      "ended",
      () => {
        if (!this.isActive(deck)) return;
        if (this.crossfading) return;
        this.handleEnded();
      },
      { signal },
    );

    audio.addEventListener(
      "error",
      () => {
        if (!this.isActive(deck)) return;
        this.setState("error");
        this.callbacks.onError?.("Unable to play this track");
      },
      { signal },
    );
  }

  private isActive(deck: Deck): boolean {
    return deck === this.active;
  }

  private handleEnded(): void {
    const ended = this.active;
    const next = this.standby;
    const nextReady =
      next.trackId !== null &&
      next.src !== null &&
      next.audio.readyState >= 2 &&
      !next.audio.error;

    if (!nextReady) {
      this.setState("ended");
      this.report({
        event: "ended",
        state: "play",
        elapsed: isFiniteDuration(ended.audio.duration)
          ? ended.audio.duration
          : this.currentTimeValue,
        trackId: ended.trackId ?? undefined,
      });
      return;
    }

    const endedTrackId = ended.trackId;
    this.swapDecks();
    this.lastEndedTrackId = endedTrackId;
    this.advanceGuardUntil = Date.now() + 2000;
    this.currentTimeValue = 0;
    this.durationValue = isFiniteDuration(this.active.audio.duration)
      ? this.active.audio.duration
      : 0;
    this.active.pendingSeek = null;
    this.pendingPlay = true;
    this.emitProgress();
    this.report({
      event: "advance",
      state: "play",
      elapsed: 0,
      trackId: this.active.trackId ?? undefined,
    });
    this.playActive();
  }

  private maybeStartCrossfade(): void {
    if (this.crossfading || this.crossfadeSeconds <= 0) return;
    if (this.stateValue !== "playing") return;
    const duration = this.active.audio.duration;
    if (!isFiniteDuration(duration)) return;
    const remaining = duration - this.currentTimeValue;
    if (remaining > this.crossfadeSeconds || remaining <= 0) return;
    const incoming = this.standby;
    if (
      incoming.trackId === null ||
      incoming.audio.readyState < 2 ||
      incoming.audio.error
    ) {
      return;
    }
    this.beginCrossfade(remaining);
  }

  private beginCrossfade(remaining: number): void {
    if (!this.ensureAudioGraph() || !this.audioContext) return;
    const outgoing = this.active;
    const incoming = this.standby;
    const fade = Math.max(0.05, Math.min(this.crossfadeSeconds, remaining));

    incoming.audio.play().catch(() => {
      // If the next deck cannot start, keep the current one playing; the
      // regular ended handler will pick up the transition.
    });

    this.active = incoming;
    this.standby = outgoing;
    this.crossfading = true;
    this.lastEndedTrackId = outgoing.trackId;
    this.advanceGuardUntil = Date.now() + 2000;
    this.currentTimeValue = 0;
    this.durationValue = isFiniteDuration(incoming.audio.duration)
      ? incoming.audio.duration
      : 0;
    incoming.pendingSeek = null;
    this.emitProgress();

    const now = this.audioContext.currentTime;
    const inGain = incoming.nodes?.gain.gain;
    const outGain = outgoing.nodes?.gain.gain;
    if (inGain && outGain) {
      inGain.cancelScheduledValues(now);
      outGain.cancelScheduledValues(now);
      inGain.setValueAtTime(0, now);
      outGain.setValueAtTime(1, now);
      inGain.linearRampToValueAtTime(1, now + fade);
      outGain.linearRampToValueAtTime(0, now + fade);
    }

    this.report({
      event: "advance",
      state: "play",
      elapsed: 0,
      trackId: incoming.trackId ?? undefined,
    });

    this.crossfadeTimer = setTimeout(() => this.finishCrossfade(), fade * 1000);
  }

  private finishCrossfade(): void {
    if (!this.crossfading) return;
    this.crossfading = false;
    this.crossfadeTimer = null;
    const outgoing = this.standby;
    outgoing.audio.pause();
    outgoing.audio.currentTime = 0;
    if (outgoing.nodes) outgoing.nodes.gain.gain.value = 0;
    if (this.active.nodes) this.active.nodes.gain.gain.value = 1;
    this.processPendingPreload();
  }

  private cancelCrossfade(): void {
    if (!this.crossfading) return;
    this.crossfading = false;
    if (this.crossfadeTimer !== null) {
      clearTimeout(this.crossfadeTimer);
      this.crossfadeTimer = null;
    }
    const outgoing = this.standby;
    outgoing.audio.pause();
    outgoing.audio.currentTime = 0;
    if (outgoing.nodes) outgoing.nodes.gain.gain.value = 0;
    if (this.active.nodes) this.active.nodes.gain.gain.value = 1;
    this.processPendingPreload();
  }

  private processPendingPreload(): void {
    const pending = this.pendingPreload;
    this.pendingPreload = null;
    if (!pending) return;
    if (this.active.trackId === pending.trackId) return;
    this.loadDeck(this.standby, pending.trackId, pending.src, 0, false);
  }

  private promoteStandby(startAt: number): void {
    this.swapDecks();
    this.active.pendingSeek = startAt > 0 ? startAt : null;
    if (startAt > 0) this.seekDeck(this.active, startAt);
    this.currentTimeValue = startAt;
    this.durationValue = isFiniteDuration(this.active.audio.duration)
      ? this.active.audio.duration
      : 0;
    this.emitProgress();
    if (this.pendingPlay) this.playActive();
  }

  private swapDecks(): void {
    const previous = this.active;
    this.active = this.standby;
    this.standby = previous;
    previous.audio.pause();
    previous.audio.currentTime = 0;
    this.resetGains();
  }

  private resetGains(): void {
    if (this.active.nodes) this.active.nodes.gain.gain.value = 1;
    if (this.standby.nodes) this.standby.nodes.gain.gain.value = 0;
  }

  private loadDeck(
    deck: Deck,
    trackId: number,
    src: string,
    startAt: number,
    resetOthers = true,
  ): void {
    deck.trackId = trackId;
    deck.src = src;
    deck.pendingSeek = startAt > 0 ? startAt : null;
    deck.audio.preload = resetOthers ? "metadata" : "auto";
    if (deck.nodes) {
      deck.nodes.gain.gain.value = resetOthers ? 1 : 0;
    } else {
      deck.audio.volume = this.volumeValue / 100;
    }
    deck.audio.src = src;
    deck.audio.load();

    if (resetOthers) {
      this.currentTimeValue = startAt;
      this.durationValue = 0;
      this.pendingPlay = false;
      this.setState("loading");
      this.emitProgress();
    }
  }

  private seekDeck(deck: Deck, time: number): void {
    const duration = isFiniteDuration(deck.audio.duration)
      ? deck.audio.duration
      : Math.max(time, 0);
    const clamped = Math.max(0, Math.min(time, duration));
    try {
      deck.audio.currentTime = clamped;
      this.currentTimeValue = clamped;
      this.emitProgress();
    } catch {
      deck.pendingSeek = clamped;
    }
  }

  private ensureAudioGraph(): boolean {
    if (this.audioContext) {
      if (this.audioContext.state === "suspended") {
        void this.audioContext.resume();
      }
      return true;
    }
    const Ctor = getAudioContextConstructor();
    if (!Ctor) return false;

    try {
      const context = new Ctor();
      const master = context.createGain();
      master.gain.value = this.volumeValue / 100;
      master.connect(context.destination);

      for (const deck of [this.active, this.standby]) {
        const source = context.createMediaElementSource(deck.audio);
        const gain = context.createGain();
        gain.gain.value = deck === this.active ? 1 : 0;
        source.connect(gain);
        gain.connect(master);
        deck.nodes = { source, gain };
        deck.audio.volume = 1;
      }

      this.audioContext = context;
      this.masterGain = master;
      if (context.state === "suspended") void context.resume();
      return true;
    } catch {
      return false;
    }
  }

  private playActive(): void {
    const audio = this.active.audio;
    if (!audio.paused) {
      this.pendingPlay = false;
      return;
    }
    this.ensureAudioGraph();
    audio.preload = "auto";
    audio.play().then(
      () => {
        this.pendingPlay = false;
        this.autoplayBlockedValue = false;
        this.callbacks.onAutoplayBlocked?.(false);
      },
      (err: unknown) => {
        this.pendingPlay = false;
        if ((err as DOMException)?.name === "NotAllowedError") {
          this.autoplayBlockedValue = true;
          this.callbacks.onAutoplayBlocked?.(true);
        } else {
          this.setState("error");
          this.callbacks.onError?.("Unable to play this track");
        }
      },
    );
  }

  private emitProgress(): void {
    this.callbacks.onProgress?.(this.currentTimeValue, this.durationValue);
  }

  private setState(state: BrowserAudioState): void {
    if (this.stateValue === state) return;
    this.stateValue = state;
    this.callbacks.onStateChange?.(state);
  }

  private report(report: PlayerReport): void {
    const enriched: PlayerReport = {
      ...report,
      elapsed: report.elapsed ?? this.currentTimeValue,
      trackId: report.trackId ?? this.active.trackId ?? undefined,
    };
    this.callbacks.onReport?.(enriched);
  }
}
