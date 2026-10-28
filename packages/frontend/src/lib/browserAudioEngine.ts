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

type Deck = {
  audio: HTMLAudioElement;
  trackId: number | null;
  src: string | null;
  pendingSeek: number | null;
};

const REPORT_INTERVAL_MS = 1000;

function createDeck(): Deck {
  const audio = new Audio();
  // Only fetch metadata until playback actually starts; the standby deck is
  // switched to `auto` when preloading the next track.
  audio.preload = "metadata";
  return { audio, trackId: null, src: null, pendingSeek: null };
}

function isFiniteDuration(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

/**
 * Browser playback engine.
 *
 * The browser is the source of truth for timing in browser mode. This engine
 * keeps two audio elements: the active one that is playing and a standby one
 * used to preload the next track. The UI reads `currentTime` from the active
 * element, and reports are sent to the backend so other devices can follow.
 */
export class BrowserAudioEngine {
  private active: Deck;
  private standby: Deck;
  private stateValue: BrowserAudioState = "idle";
  private currentTimeValue = 0;
  private durationValue = 0;
  private volumeValue = 100;
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
    this.loadDeck(this.standby, trackId, src, 0, false);
  }

  play(): void {
    if (this.destroyed) return;
    this.pendingPlay = true;
    this.playActive();
  }

  pause(): void {
    if (this.destroyed) return;
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
    this.active.audio.volume = value;
    this.standby.audio.volume = value;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.abort.abort();
    for (const deck of [this.active, this.standby]) {
      deck.audio.pause();
      deck.audio.removeAttribute("src");
      deck.audio.load();
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

    audio.addEventListener(
      "volumechange",
      () => {
        if (!this.isActive(deck)) return;
        this.volumeValue = Math.round(audio.volume * 100);
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

  private playActive(): void {
    const audio = this.active.audio;
    if (!audio.paused) {
      this.pendingPlay = false;
      return;
    }
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
