import type { PlayerReport } from "@repo/types";
import { DEFAULT_VOLUME, volumeToGain } from "@/lib/volume";

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
  private volumeValue = DEFAULT_VOLUME;
  private crossfadeSeconds = 0;
  private crossfading = false;
  private crossfadeStarting = false;
  private crossfadeAttempt = 0;
  private crossfadeRetryAfter = 0;
  private crossfadeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPreload: { trackId: number; src: string } | null = null;
  private expectedNextTrackId: number | null = null;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private pendingPlay = false;
  private autoplayBlockedValue = false;
  private lastReportAt = 0;
  private epochValue: string | null = null;
  private revisionValue = 0;
  private lastEndedTrackId: number | null = null;
  private failureReportedTrackId: number | null = null;
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
    epoch?: string,
    revision = 0,
  ): void {
    if (this.destroyed) return;

    // A new server epoch means the session was recreated (backend restart or
    // idle eviction): drop every local guard and force a fresh load.
    const epochChanged = epoch !== undefined && epoch !== this.epochValue;
    if (epochChanged) {
      this.epochValue = epoch;
      this.revisionValue = -1;
      this.lastEndedTrackId = null;
      this.advanceGuardUntil = 0;
    }

    // After a local advance, ignore an in-flight status for the track that
    // just ended. A real command to go back to it bumps the server revision.
    if (
      Date.now() < this.advanceGuardUntil &&
      this.lastEndedTrackId === trackId &&
      revision <= this.revisionValue
    ) {
      return;
    }
    if (revision < this.revisionValue && this.active.trackId === trackId) {
      return;
    }
    this.revisionValue = Math.max(this.revisionValue, revision);
    if (this.lastEndedTrackId === trackId) this.lastEndedTrackId = null;

    if (this.active.trackId === trackId && !epochChanged) {
      if (this.stateValue !== "error") return;
      // A stream failure keeps the same track loaded; reload it on the next
      // play command instead of ignoring the command.
      this.loadDeck(this.active, trackId, src, startAt);
      return;
    }

    this.cancelCrossfade();
    this.pendingPreload = null;
    this.expectedNextTrackId = null;
    if (this.standby.trackId === trackId && !epochChanged) {
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
    this.expectedNextTrackId = trackId;
    if (this.standby.trackId === trackId && this.standby.src === src) return;
    if (this.crossfading || this.crossfadeStarting) {
      // The standby is still fading out; preload after the crossfade finishes.
      this.pendingPreload = { trackId, src };
      return;
    }
    this.loadDeck(this.standby, trackId, src, 0, false);
  }

  /**
   * Clears the expected next track. Called when the server reports that the
   * queue has no next track, so a stale standby deck is never promoted.
   */
  clearPreload(): void {
    if (this.destroyed) return;
    this.pendingPreload = null;
    this.expectedNextTrackId = null;
    if (this.crossfading || this.crossfadeStarting) return;
    if (this.standby.trackId === null && this.standby.src === null) return;
    this.resetDeck(this.standby);
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
    const gain = volumeToGain(clamped);
    if (this.masterGain && this.audioContext) {
      // Smooth the gain change to avoid clicks/pops while dragging.
      this.masterGain.gain.setTargetAtTime(
        gain,
        this.audioContext.currentTime,
        0.015,
      );
    } else {
      this.active.audio.volume = gain;
      this.standby.audio.volume = gain;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.crossfadeAttempt += 1;
    this.crossfadeStarting = false;
    this.expectedNextTrackId = null;
    this.pendingPreload = null;
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
        this.reportFailureOnce();
      },
      { signal },
    );
  }

  private isActive(deck: Deck): boolean {
    return deck === this.active;
  }

  private handleEnded(): void {
    if (this.crossfadeStarting) {
      // The track ended before the incoming deck's play() settled. Invalidate
      // that attempt so it cannot swap or pause the deck we promote below.
      this.crossfadeAttempt += 1;
      this.crossfadeStarting = false;
    }
    const ended = this.active;
    const next = this.standby;
    const nextReady =
      this.expectedNextTrackId !== null &&
      next.trackId === this.expectedNextTrackId &&
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
        fromTrackId: ended.trackId ?? undefined,
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
      fromTrackId: endedTrackId ?? undefined,
    });
    this.playActive();
  }

  private maybeStartCrossfade(): void {
    if (this.crossfading || this.crossfadeStarting) return;
    if (this.crossfadeSeconds <= 0) return;
    if (Date.now() < this.crossfadeRetryAfter) return;
    if (this.stateValue !== "playing") return;
    const duration = this.active.audio.duration;
    if (!isFiniteDuration(duration)) return;
    const remaining = duration - this.currentTimeValue;
    if (remaining > this.crossfadeSeconds || remaining <= 0) return;
    const incoming = this.standby;
    if (
      this.expectedNextTrackId === null ||
      incoming.trackId !== this.expectedNextTrackId ||
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
    if (
      incoming.trackId === null ||
      incoming.trackId !== this.expectedNextTrackId
    ) {
      return;
    }
    const fade = Math.max(0.05, Math.min(this.crossfadeSeconds, remaining));
    const attempt = ++this.crossfadeAttempt;
    this.crossfadeStarting = true;
    this.resetGains();

    incoming.audio.play().then(
      () => {
        if (this.destroyed || attempt !== this.crossfadeAttempt) {
          // The transition was superseded (pause/seek/new track). Only stop
          // the incoming deck if it did not become the active one meanwhile.
          if (this.active !== incoming) incoming.audio.pause();
          this.resetGains();
          return;
        }
        if (this.standby !== incoming) {
          this.crossfadeStarting = false;
          this.resetGains();
          return;
        }

        this.crossfadeStarting = false;
        this.active = incoming;
        this.standby = outgoing;
        this.crossfading = true;
        this.expectedNextTrackId = null;
        this.lastEndedTrackId = outgoing.trackId;
        this.advanceGuardUntil = Date.now() + 2000;
        this.currentTimeValue = 0;
        this.durationValue = isFiniteDuration(incoming.audio.duration)
          ? incoming.audio.duration
          : 0;
        incoming.pendingSeek = null;
        this.emitProgress();

        const context = this.audioContext;
        if (!context) return;
        const now = context.currentTime;
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
          fromTrackId: outgoing.trackId ?? undefined,
        });

        this.crossfadeTimer = setTimeout(
          () => this.finishCrossfade(),
          fade * 1000,
        );
      },
      () => {
        if (attempt !== this.crossfadeAttempt) return;
        // The incoming deck could not start: keep the outgoing track playing
        // and let the regular ended path handle the transition.
        this.crossfadeStarting = false;
        this.crossfadeRetryAfter = Date.now() + 1000;
        this.resetGains();
      },
    );
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
    this.crossfadeAttempt += 1;
    this.crossfadeStarting = false;
    if (!this.crossfading) {
      if (this.pendingPreload) this.processPendingPreload();
      return;
    }
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
    if (!pending) {
      this.expectedNextTrackId = null;
      return;
    }
    if (this.active.trackId === pending.trackId) {
      this.expectedNextTrackId = null;
      return;
    }
    this.expectedNextTrackId = pending.trackId;
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
    this.expectedNextTrackId = null;
    this.pendingPreload = null;
    previous.audio.pause();
    previous.audio.currentTime = 0;
    this.resetGains();
  }

  private resetDeck(deck: Deck): void {
    deck.trackId = null;
    deck.src = null;
    deck.pendingSeek = null;
    deck.audio.pause();
    deck.audio.currentTime = 0;
    deck.audio.removeAttribute("src");
    deck.audio.load();
    if (deck.nodes) deck.nodes.gain.gain.value = 0;
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
      deck.audio.volume = volumeToGain(this.volumeValue);
    }
    deck.audio.src = src;
    deck.audio.load();

    if (resetOthers) {
      this.currentTimeValue = startAt;
      this.durationValue = 0;
      this.pendingPlay = false;
      this.failureReportedTrackId = null;
      this.crossfadeRetryAfter = 0;
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
      master.gain.value = volumeToGain(this.volumeValue);
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
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError") {
          this.autoplayBlockedValue = true;
          this.callbacks.onAutoplayBlocked?.(true);
        } else if (name !== "AbortError") {
          this.setState("error");
          this.callbacks.onError?.("Unable to play this track");
          this.reportFailureOnce();
        }
      },
    );
  }

  private reportFailureOnce(): void {
    const trackId = this.active.trackId;
    if (trackId === null || this.failureReportedTrackId === trackId) return;
    this.failureReportedTrackId = trackId;
    // Tell the server the track cannot be played so it can advance instead of
    // leaving every device stuck on a broken stream.
    this.report({
      event: "ended",
      state: "play",
      elapsed: this.currentTimeValue,
      trackId,
      fromTrackId: trackId,
    });
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
      epoch: report.epoch ?? this.epochValue ?? undefined,
    };
    this.callbacks.onReport?.(enriched);
  }
}
