import { EventEmitter } from "events";
import { profileSettingsDb } from "@repo/db";
import type { LogService } from "../utils/logService.js";
import type { MpdConfigService } from "../mpd/mpdConfigService.js";
import {
  SessionRegistry,
  resolveSessionRegistry,
} from "../session/sessionRegistry.js";
import { SessionPlayer } from "../session/sessionPlayer.js";
import { MpdAdapter, type PlaybackEngine } from "./mpdAdapter.js";
import type { PlayerServiceImpl } from "./playerService.js";
import type { MpdConnectionManager } from "../mpd/mpdConnectionManager.js";
import type {
  OutputMode,
  PlaybackStatus,
  PlayerReport,
  QueuedTrack,
} from "@repo/types";

type SessionRecord = {
  mode: OutputMode;
  engine: PlaybackEngine & EventEmitter;
  activeDeviceId: string | null;
  activeDeviceName: string | null;
  activeDeviceType: string | null;
  volume: number;
  crossfade: number;
};

function fmtSid(id: string): string {
  return id.slice(0, 8);
}

export class PlayerRouter extends EventEmitter {
  private records = new Map<string, SessionRecord>();
  private forwarders = new Map<string, () => void>();

  constructor(
    private readonly _sessionRegistry: SessionRegistry,
    private readonly mpdConfigService: MpdConfigService,
    private readonly playerService: PlayerServiceImpl,
    private readonly mpdConnectionManager: MpdConnectionManager,
    private readonly logService: LogService,
  ) {
    super();
  }

  private get sessionRegistry(): SessionRegistry {
    try {
      return resolveSessionRegistry();
    } catch {
      return this._sessionRegistry;
    }
  }

  private createMpdEngine(sessionId?: string): PlaybackEngine & EventEmitter {
    return new MpdAdapter(
      this.playerService,
      this.mpdConnectionManager,
      this.logService,
      sessionId,
    ) as unknown as PlaybackEngine & EventEmitter;
  }

  private attachForwarder(
    sessionId: string,
    engine: PlaybackEngine & EventEmitter,
  ): void {
    const prev = this.forwarders.get(sessionId);
    if (prev) prev();
    const onState = () => this.emit(`session:${sessionId}:stateChanged`);
    const onTrack = (track: unknown) =>
      this.emit("trackChanged", { sessionId, track });
    engine.on("stateChanged", onState);
    engine.on("trackChanged", onTrack);
    this.forwarders.set(sessionId, () => {
      engine.off("stateChanged", onState);
      engine.off("trackChanged", onTrack);
    });
  }

  private detachForwarder(sessionId: string): void {
    const off = this.forwarders.get(sessionId);
    if (off) {
      off();
      this.forwarders.delete(sessionId);
    }
  }

  private ensureRecord(sessionId: string): SessionRecord {
    let rec = this.records.get(sessionId);
    if (rec) return rec;
    const engine = this.wrapSessionPlayer(sessionId);
    rec = {
      mode: "browser",
      engine,
      activeDeviceId: null,
      activeDeviceName: null,
      activeDeviceType: null,
      volume: 100,
      crossfade: profileSettingsDb.get(sessionId).crossfadeSeconds,
    };
    this.records.set(sessionId, rec);
    this.attachForwarder(sessionId, engine);
    this.logService?.pushLog?.(
      "debug",
      `[Session ${fmtSid(sessionId)}][browser] created isolated session`,
      {
        sessionId: fmtSid(sessionId),
        mode: "browser",
      },
    );
    return rec;
  }

  private wrapSessionPlayer(sessionId: string): PlaybackEngine & EventEmitter {
    const s = this.sessionRegistry.getOrCreateSession(sessionId);
    const adapter = new (class extends EventEmitter implements PlaybackEngine {
      constructor(private p: SessionPlayer) {
        super();
        this.p.on("stateChanged", () => this.emit("stateChanged"));
        this.p.on("trackChanged", (track) => this.emit("trackChanged", track));
      }
      getStatus(): PlaybackStatus {
        return this.p.getStatus();
      }
      async playTrack(file: string): Promise<void> {
        this.p.playTrack(file);
      }
      async pause(): Promise<void> {
        this.p.pause();
      }
      async resume(): Promise<void> {
        this.p.resume();
      }
      async next(): Promise<void> {
        this.p.next();
      }
      async previous(): Promise<void> {
        this.p.previous();
      }
      async seek(position: number): Promise<void> {
        this.p.seek(position);
      }
      async getQueue(): Promise<QueuedTrack[]> {
        const q = this.p.getQueue();
        return q.map((e, idx) => ({
          id: e.id,
          trackId: e.id,
          file: e.file,
          title: e.title,
          artist_name: e.artist_name,
          album: e.album,
          duration: e.duration,
          pos: idx,
          mpdId: e.id,
          cover_path: e.cover_path,
        }));
      }
      async addToQueue(file: string): Promise<void> {
        this.p.addToQueue(file);
      }
      async playFiles(files: string[], startAt = 0): Promise<void> {
        this.p.playFiles(files, startAt);
      }
      async removeFromQueue(pos: number): Promise<void> {
        this.p.removeFromQueue(pos);
      }
      async moveQueueItem(from: number, to: number): Promise<void> {
        this.p.moveQueueItem(from, to);
      }
      async setVolume(_volume: number): Promise<void> {}
      async enableRandom(_enabled: boolean): Promise<void> {}
      async enableRepeat(_enabled: boolean): Promise<void> {}
      async playPosition(pos: number): Promise<void> {
        this.p.playPosition(pos);
      }
      reportPlayback(report: PlayerReport): void {
        this.p.reportPlayback(report);
      }
    })(s);
    return adapter;
  }

  forSession(sessionId: string): PlaybackEngine & EventEmitter {
    return this.ensureRecord(sessionId).engine;
  }

  getMode(sessionId: string): OutputMode {
    return this.ensureRecord(sessionId).mode;
  }

  getActiveDevice(sessionId: string): string | null {
    return this.ensureRecord(sessionId).activeDeviceId;
  }

  getActiveDeviceName(sessionId: string): string | null {
    return this.ensureRecord(sessionId).activeDeviceName;
  }

  getActiveDeviceType(sessionId: string): string | null {
    return this.ensureRecord(sessionId).activeDeviceType;
  }

  setActiveDeviceIfUnclaimed(
    sessionId: string,
    deviceId: string | null,
    deviceName: string | null = null,
    deviceType: string | null = null,
  ): void {
    if (!deviceId) return;
    const rec = this.ensureRecord(sessionId);
    if (rec.mode !== "browser") return;
    if (rec.activeDeviceId === null) {
      rec.activeDeviceId = deviceId;
      rec.activeDeviceName = deviceName;
      rec.activeDeviceType = deviceType;
      this.emit(`session:${sessionId}:stateChanged`);
      this.logService?.pushLog?.(
        "info",
        `[Session ${fmtSid(sessionId)}][browser] claimed by device ${deviceId.slice(0, 8)}`,
        { sessionId: fmtSid(sessionId), deviceId: deviceId.slice(0, 8) },
      );
    }
  }

  /**
   * Mirrors a factual report from the active browser device. Reports from
   * other devices (or in MPD mode) are ignored so timing cannot be hijacked.
   */
  reportPlayback(
    sessionId: string,
    deviceId: string | null,
    report: PlayerReport,
    deviceName: string | null = null,
    deviceType: string | null = null,
  ): boolean {
    if (!deviceId) return false;
    const rec = this.ensureRecord(sessionId);
    if (rec.mode !== "browser") return false;
    if (rec.activeDeviceId === null) {
      // Claim silently: the report that follows emits stateChanged with the
      // claim included, so we avoid an intermediate status without the report.
      rec.activeDeviceId = deviceId;
      rec.activeDeviceName = deviceName;
      rec.activeDeviceType = deviceType;
      this.logService?.pushLog?.(
        "info",
        `[Session ${fmtSid(sessionId)}][browser] claimed by device ${deviceId.slice(0, 8)}`,
        { sessionId: fmtSid(sessionId), deviceId: deviceId.slice(0, 8) },
      );
    }
    if (rec.activeDeviceId !== deviceId) return false;
    rec.engine.reportPlayback(report);
    return true;
  }

  /**
   * Called when the device that owned browser playback disconnects. Clearing
   * the claim lets another tab take over instead of staying stuck as "active".
   */
  releaseActiveDevice(sessionId: string, deviceId: string | null): void {
    if (!deviceId) return;
    const rec = this.records.get(sessionId);
    if (!rec || rec.mode !== "browser" || rec.activeDeviceId !== deviceId) {
      return;
    }
    rec.activeDeviceId = null;
    rec.activeDeviceName = null;
    rec.activeDeviceType = null;
    try {
      void rec.engine.pause();
    } catch {
      // engine may already be torn down
    }
    this.emit(`session:${sessionId}:stateChanged`);
    this.logService?.pushLog?.(
      "debug",
      `[Session ${fmtSid(sessionId)}][browser] released active device ${deviceId.slice(0, 8)}`,
      { sessionId: fmtSid(sessionId), deviceId: deviceId.slice(0, 8) },
    );
  }

  /**
   * Updates the crossfade for a profile and applies it to MPD immediately when
   * that profile currently owns the MPD output. Browser sessions pick up the
   * value from the next `player-status`.
   */
  setCrossfade(sessionId: string, seconds: number): number {
    const value = Math.max(0, Math.min(30, Math.round(seconds)));
    const rec = this.ensureRecord(sessionId);
    rec.crossfade = value;
    if (
      rec.mode === "mpd" &&
      this.mpdConfigService.getMpdOwner() === sessionId
    ) {
      this.applyMpdCrossfade(value);
    }
    this.emit(`session:${sessionId}:stateChanged`);
    this.logService?.pushLog?.(
      "info",
      `[Session ${fmtSid(sessionId)}] crossfade set to ${value}s`,
      { sessionId: fmtSid(sessionId), crossfade: value, mode: rec.mode },
    );
    return value;
  }

  /**
   * Re-applies the current MPD owner's crossfade after the daemon reconnects
   * (MPD resets runtime playback options on restart).
   */
  onMpdConnected(): void {
    const owner = this.mpdConfigService.getMpdOwner();
    if (!owner) return;
    const rec = this.records.get(owner);
    if (!rec || rec.mode !== "mpd") return;
    this.applyMpdCrossfade(rec.crossfade);
  }

  private applyMpdCrossfade(seconds: number): void {
    this.mpdConnectionManager
      .executeCommand("crossfade", [String(seconds)])
      .catch((err: unknown) => {
        this.logService?.pushLog?.(
          "warn",
          `[MPD] failed to apply crossfade ${seconds}s: ${String(err)}`,
          { crossfade: seconds, error: String(err) },
        );
      });
  }

  getMpdOwner(): string | null {
    return this.mpdConfigService.getMpdOwner();
  }

  getOutputDeviceName(): string | null {
    return this.mpdConfigService.getOutputDeviceName();
  }

  async setMode(
    sessionId: string,
    mode: OutputMode,
    deviceId?: string | null,
    deviceName?: string | null,
    deviceType?: string | null,
  ): Promise<{ success: boolean; warning?: string }> {
    const rec = this.ensureRecord(sessionId);
    // Browser -> browser device handoff (no engine swap)
    if (rec.mode === "browser" && mode === "browser") {
      const nextDevice = deviceId ?? rec.activeDeviceId;
      if (rec.activeDeviceId === nextDevice) {
        // update name/type even if same device (e.g. UA changed)
        if (deviceName) rec.activeDeviceName = deviceName;
        if (deviceType) rec.activeDeviceType = deviceType;
        this.logService?.pushLog?.(
          "debug",
          `[Session ${fmtSid(sessionId)}][browser] outputMode already browser device=${nextDevice?.slice(0, 8) ?? "null"}`,
          { sessionId: fmtSid(sessionId), deviceId: nextDevice?.slice(0, 8) },
        );
        return { success: true };
      }
      const prevDevice = rec.activeDeviceId;
      rec.activeDeviceId = nextDevice ?? null;
      rec.activeDeviceName = deviceName ?? null;
      rec.activeDeviceType = deviceType ?? null;
      this.emit(`session:${sessionId}:stateChanged`);
      this.logService?.pushLog?.(
        "info",
        `[Session ${fmtSid(sessionId)}][browser] handoff ${prevDevice?.slice(0, 8) ?? "null"} → ${nextDevice?.slice(0, 8) ?? "null"}`,
        {
          sessionId: fmtSid(sessionId),
          from: prevDevice?.slice(0, 8),
          to: nextDevice?.slice(0, 8),
        },
      );
      return { success: true };
    }
    if (rec.mode === mode) {
      this.logService?.pushLog?.(
        "debug",
        `[Session ${fmtSid(sessionId)}][${mode}] outputMode already ${mode}`,
        {
          sessionId: fmtSid(sessionId),
          mode,
        },
      );
      return { success: true };
    }

    // Capture current track + seek before swapping (re-play semantics)
    let prevFile: string | undefined;
    let prevElapsed = 0;
    let prevState: string = "stop";
    try {
      const st = rec.engine.getStatus();
      prevFile = st.track?.file;
      prevElapsed = st.elapsed ?? 0;
      prevState = st.state;
    } catch {
      // ignore
    }

    // Pause old engine to stop playback (clear browser clock / pause MPD)
    try {
      if (rec.mode === "browser") {
        await rec.engine.pause();
        this.logService?.pushLog?.(
          "debug",
          `[Session ${fmtSid(sessionId)}][browser] pause on outputMode → ${mode}`,
          {
            sessionId: fmtSid(sessionId),
            to: mode,
          },
        );
      } else if (rec.mode === "mpd") {
        await (rec.engine as unknown as MpdAdapter).pause();
        this.logService?.pushLog?.(
          "debug",
          `[Session ${fmtSid(sessionId)}][mpd] pause on outputMode → ${mode}`,
          {
            sessionId: fmtSid(sessionId),
            to: mode,
          },
        );
      }
    } catch (err) {
      this.logService?.pushLog?.(
        "warn",
        `[Session ${fmtSid(sessionId)}] pause old engine failed: ${String(err)}`,
        {
          sessionId: fmtSid(sessionId),
          error: String(err),
        },
      );
    }

    if (mode === "mpd") {
      const acquired = this.mpdConfigService.tryAcquireMpd(sessionId);
      if (!acquired.success) {
        this.logService?.pushLog?.(
          "warn",
          `[Session ${fmtSid(sessionId)}] outputMode → mpd failed: locked by ${fmtSid(acquired.owner ?? "unknown")}`,
          {
            sessionId: fmtSid(sessionId),
            requestedMode: mode,
            owner: acquired.owner ? fmtSid(acquired.owner) : undefined,
          },
        );
        return {
          success: false,
          warning: `MPD locked by ${acquired.owner ?? "another session"}`,
        };
      }
      this.applyMpdCrossfade(rec.crossfade);
      this.detachForwarder(sessionId);
      rec.engine.removeAllListeners("stateChanged");
      const mpdEngine = this.createMpdEngine(sessionId);
      this.records.set(sessionId, {
        mode,
        engine: mpdEngine,
        activeDeviceId: null,
        activeDeviceName: null,
        activeDeviceType: null,
        volume: rec.volume ?? 100,
        crossfade: rec.crossfade,
      });
      this.attachForwarder(sessionId, mpdEngine);
      // Re-play with clear semantics at same seek
      if (prevFile) {
        try {
          await mpdEngine.playTrack(prevFile);
          if (prevState !== "stop" && prevElapsed > 0) {
            await mpdEngine.seek(prevElapsed);
          }
          if (prevState === "pause") {
            await mpdEngine.pause();
          }
          this.logService?.pushLog?.(
            "info",
            `[Session ${fmtSid(sessionId)}] browser→mpd re-play file="${prevFile}" seek=${prevElapsed} state=${prevState}`,
            {
              sessionId: fmtSid(sessionId),
              file: prevFile,
              seek: prevElapsed,
              state: prevState,
            },
          );
        } catch (err) {
          this.logService?.pushLog?.(
            "error",
            `[Session ${fmtSid(sessionId)}] browser→mpd handoff failed: ${String(err)}`,
            {
              sessionId: fmtSid(sessionId),
              error: String(err),
            },
          );
        }
      }
      this.emit(`session:${sessionId}:stateChanged`);
      this.logService?.pushLog?.(
        "info",
        `[Session ${fmtSid(sessionId)}] outputMode ${rec.mode} → mpd (acquired)`,
        {
          sessionId: fmtSid(sessionId),
          from: rec.mode,
          to: mode,
          engine: "mpd",
        },
      );
      return this.mpdConfigService.setOutputMode(mode);
    } else {
      this.mpdConfigService.releaseMpd(sessionId);
      this.detachForwarder(sessionId);
      rec.engine.removeAllListeners("stateChanged");
      if (
        typeof (rec.engine as unknown as { dispose?: () => void }).dispose ===
        "function"
      ) {
        (rec.engine as unknown as { dispose: () => void }).dispose!();
      }
      const browserEngine = this.wrapSessionPlayer(sessionId);
      this.records.set(sessionId, {
        mode,
        engine: browserEngine,
        activeDeviceId: deviceId ?? null,
        activeDeviceName: deviceName ?? null,
        activeDeviceType: deviceType ?? null,
        volume: rec.volume ?? 100,
        crossfade: rec.crossfade,
      });
      this.attachForwarder(sessionId, browserEngine);
      if (prevFile) {
        try {
          await browserEngine.playTrack(prevFile);
          if (prevState !== "stop" && prevElapsed > 0) {
            await browserEngine.seek(prevElapsed);
          }
          if (prevState === "pause") {
            await browserEngine.pause();
          }
          this.logService?.pushLog?.(
            "info",
            `[Session ${fmtSid(sessionId)}] mpd→browser re-play file="${prevFile}" seek=${prevElapsed} state=${prevState}`,
            {
              sessionId: fmtSid(sessionId),
              file: prevFile,
              seek: prevElapsed,
              state: prevState,
            },
          );
        } catch (err) {
          this.logService?.pushLog?.(
            "error",
            `[Session ${fmtSid(sessionId)}] mpd→browser handoff failed: ${String(err)}`,
            {
              sessionId: fmtSid(sessionId),
              error: String(err),
            },
          );
        }
      }
      this.emit(`session:${sessionId}:stateChanged`);
      this.logService?.pushLog?.(
        "info",
        `[Session ${fmtSid(sessionId)}] outputMode ${rec.mode} → browser (released)`,
        {
          sessionId: fmtSid(sessionId),
          from: rec.mode,
          to: mode,
          engine: "browser",
        },
      );
      return this.mpdConfigService.setOutputMode(mode);
    }
  }

  getStatus(sessionId: string): PlaybackStatus {
    const rec = this.ensureRecord(sessionId);
    const base = rec.engine.getStatus();
    const volume = rec.mode === "browser" ? rec.volume : base.volume;
    return {
      ...base,
      volume,
      activeDeviceId: rec.activeDeviceId,
      activeDeviceName: rec.activeDeviceName,
      activeDeviceType: rec.activeDeviceType,
      mode: rec.mode,
      crossfade: rec.crossfade,
    } as PlaybackStatus;
  }

  async setVolume(sessionId: string, volume: number): Promise<void> {
    const rec = this.ensureRecord(sessionId);
    if (rec.mode === "browser") {
      rec.volume = Math.max(0, Math.min(100, volume));
      this.emit(`session:${sessionId}:stateChanged`);
      return;
    }
    await rec.engine.setVolume(volume);
  }

  onStateChanged(sessionId: string, cb: () => void): () => void {
    const rec = this.ensureRecord(sessionId);
    // ensure forwarder exists
    if (!this.forwarders.has(sessionId)) {
      this.attachForwarder(sessionId, rec.engine);
    }
    this.on(`session:${sessionId}:stateChanged`, cb);
    return () => this.off(`session:${sessionId}:stateChanged`, cb);
  }
}

let singleton: PlayerRouter | null = null;

export function setGlobalPlayerRouter(r: PlayerRouter): void {
  singleton = r;
}
export function resolvePlayerRouter(): PlayerRouter {
  if (singleton) return singleton;
  throw new Error("PlayerRouter not initialized");
}
