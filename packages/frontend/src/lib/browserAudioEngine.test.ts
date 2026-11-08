import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerReport } from "@repo/types";
import { BrowserAudioEngine } from "./browserAudioEngine";

class FakeAudio {
  static instances: FakeAudio[] = [];

  currentTime = 0;
  duration = 100;
  readyState = 4;
  error: MediaError | null = null;
  preload = "";
  volume = 1;
  paused = true;
  src = "";

  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  constructor() {
    FakeAudio.instances.push(this);
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ): void {
    const callbacks = this.listeners.get(type) ?? new Set();
    if (typeof listener === "function") callbacks.add(listener);
    this.listeners.set(type, callbacks);
  }

  removeEventListener(): void {}

  load(): void {}

  removeAttribute(name: string): void {
    if (name === "src") this.src = "";
  }

  play = vi.fn((): Promise<void> => {
    this.paused = false;
    this.emit("playing");
    return Promise.resolve();
  });

  pause = vi.fn((): void => {
    this.paused = true;
  });

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new Event(type));
    }
  }
}

class FakeGainParam {
  value = 1;
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
  setTargetAtTime = vi.fn();
}

class FakeGainNode {
  static instances: FakeGainNode[] = [];
  gain = new FakeGainParam();
  connect = vi.fn();

  constructor() {
    FakeGainNode.instances.push(this);
  }
}

class FakeSourceNode {
  connect = vi.fn();
}

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  createGain(): FakeGainNode {
    return new FakeGainNode();
  }
  createMediaElementSource(): FakeSourceNode {
    return new FakeSourceNode();
  }
  resume = vi.fn((): Promise<void> => Promise.resolve());
  close = vi.fn((): Promise<void> => Promise.resolve());
}

describe("BrowserAudioEngine deck transitions", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    FakeGainNode.instances = [];
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports ended instead of replaying the previous track at the end of the queue", async () => {
    const reports: PlayerReport[] = [];
    const engine = new BrowserAudioEngine({
      onReport: (report) => reports.push(report),
    });

    engine.startTrack(1, "/stream/1", 0, "epoch-1", 1);
    engine.preloadTrack(2, "/stream/2");
    engine.play();
    await vi.waitFor(() => expect(engine.state).toBe("playing"));

    const [first, second] = FakeAudio.instances;
    first.emit("ended");
    expect(engine.getTrackId()).toBe(2);

    // The queue has no next track: the standby deck still holds track 1 and
    // must not be promoted again.
    second.emit("ended");
    await Promise.resolve();

    expect(engine.getTrackId()).toBe(2);
    expect(reports.at(-1)).toMatchObject({
      event: "ended",
      fromTrackId: 2,
    });
  });

  it("does not promote a preloaded track when the server reports no next track", async () => {
    const reports: PlayerReport[] = [];
    const engine = new BrowserAudioEngine({
      onReport: (report) => reports.push(report),
    });

    engine.startTrack(1, "/stream/1", 0, "epoch-1", 1);
    engine.preloadTrack(2, "/stream/2");
    engine.clearPreload();
    engine.play();
    await vi.waitFor(() => expect(engine.state).toBe("playing"));

    const [first] = FakeAudio.instances;
    first.emit("ended");
    await Promise.resolve();

    expect(engine.getTrackId()).toBe(1);
    expect(reports.at(-1)).toMatchObject({
      event: "ended",
      fromTrackId: 1,
    });
  });

  it("keeps the current track when the incoming deck rejects a crossfade", async () => {
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
    const reports: PlayerReport[] = [];
    const engine = new BrowserAudioEngine({
      onReport: (report) => reports.push(report),
    });

    engine.setCrossfade(5);
    engine.startTrack(1, "/stream/1", 0, "epoch-1", 1);
    engine.preloadTrack(2, "/stream/2");
    engine.play();
    await vi.waitFor(() => expect(engine.state).toBe("playing"));

    const [first, second] = FakeAudio.instances;
    second.play.mockRejectedValueOnce(
      new DOMException("blocked", "NotAllowedError"),
    );
    first.currentTime = 96;
    first.emit("timeupdate");
    await Promise.resolve();
    await Promise.resolve();

    expect(engine.getTrackId()).toBe(1);
    expect(reports.some((report) => report.event === "advance")).toBe(false);
  });

  it("promotes the incoming deck after a successful crossfade", async () => {
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
    const reports: PlayerReport[] = [];
    const engine = new BrowserAudioEngine({
      onReport: (report) => reports.push(report),
    });

    engine.setCrossfade(5);
    engine.startTrack(1, "/stream/1", 0, "epoch-1", 1);
    engine.preloadTrack(2, "/stream/2");
    engine.play();
    await vi.waitFor(() => expect(engine.state).toBe("playing"));

    const [first] = FakeAudio.instances;
    first.currentTime = 96;
    first.emit("timeupdate");
    await vi.waitFor(() => expect(engine.getTrackId()).toBe(2));

    expect(
      reports.some(
        (report) => report.event === "advance" && report.trackId === 2,
      ),
    ).toBe(true);
  });

  it("reports ended only once when the active stream fails", async () => {
    const reports: PlayerReport[] = [];
    const engine = new BrowserAudioEngine({
      onReport: (report) => reports.push(report),
    });

    engine.startTrack(1, "/stream/1", 0, "epoch-1", 1);
    engine.play();
    await vi.waitFor(() => expect(engine.state).toBe("playing"));

    const [first] = FakeAudio.instances;
    first.emit("error");
    first.emit("error");
    await Promise.resolve();

    const ended = reports.filter((report) => report.event === "ended");
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ fromTrackId: 1 });
  });

  it("applies the perceptual curve to HTMLMediaElement volume", () => {
    const engine = new BrowserAudioEngine();
    const [active, standby] = FakeAudio.instances;

    engine.setVolume(50);

    expect(active.volume).toBe(0.25);
    expect(standby.volume).toBe(0.25);
  });

  it("ramps the master gain with setTargetAtTime", async () => {
    vi.stubGlobal("window", { AudioContext: FakeAudioContext });
    const engine = new BrowserAudioEngine();
    engine.startTrack(1, "/stream/1", 0, "epoch-1", 1);
    engine.play();
    await vi.waitFor(() => expect(engine.state).toBe("playing"));

    engine.setVolume(50);

    expect(FakeGainNode.instances[0].gain.setTargetAtTime).toHaveBeenCalledWith(
      0.25,
      0,
      0.015,
    );
  });
});
