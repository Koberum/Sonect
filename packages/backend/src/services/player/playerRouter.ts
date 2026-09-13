import { EventEmitter } from "events";
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
import type { AutoplayService } from "../mpd/autoplayService.js";
import type { OutputMode, PlaybackStatus, QueuedTrack } from "@repo/types";

type SessionRecord = {
  mode: OutputMode;
  engine: PlaybackEngine & EventEmitter;
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
    private readonly autoplayService: AutoplayService,
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

  private createBrowserEngine(
    sessionId: string,
  ): PlaybackEngine & EventEmitter {
    const s = this.sessionRegistry.getOrCreateSession(sessionId);
    const emitter = s as unknown as PlaybackEngine & EventEmitter;
    return emitter as unknown as PlaybackEngine & EventEmitter;
  }

  private createMpdEngine(sessionId?: string): PlaybackEngine & EventEmitter {
    return new MpdAdapter(
      this.playerService,
      this.mpdConnectionManager,
      this.logService,
      this.autoplayService,
      sessionId,
    ) as unknown as PlaybackEngine & EventEmitter;
  }

  private attachForwarder(
    sessionId: string,
    engine: PlaybackEngine & EventEmitter,
  ): void {
    const prev = this.forwarders.get(sessionId);
    if (prev) prev();
    const handler = () => this.emit(`session:${sessionId}:stateChanged`);
    engine.on("stateChanged", handler);
    this.forwarders.set(sessionId, () => engine.off("stateChanged", handler));
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
    rec = { mode: "browser", engine };
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
        const q = this.p.getQueue();
        if (pos < 0 || pos >= q.length) return;
        const target = q[pos];
        if (target) this.p.playTrack(target.file);
        const anyP = this.p as unknown as Record<string, unknown>;
        if (typeof anyP["indexInternal"] !== "undefined") {
          // fallback
        }
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

  getMpdOwner(): string | null {
    return this.mpdConfigService.getMpdOwner();
  }

  getOutputDeviceName(): string | null {
    return this.mpdConfigService.getOutputDeviceName();
  }

  async setMode(
    sessionId: string,
    mode: OutputMode,
  ): Promise<{ success: boolean; warning?: string }> {
    const rec = this.ensureRecord(sessionId);
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
      this.detachForwarder(sessionId);
      rec.engine.removeAllListeners("stateChanged");
      const mpdEngine = this.createMpdEngine(sessionId);
      this.records.set(sessionId, { mode, engine: mpdEngine });
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
      this.records.set(sessionId, { mode, engine: browserEngine });
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
    return this.forSession(sessionId).getStatus();
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

  dispose(): void {
    for (const sid of this.forwarders.keys()) this.detachForwarder(sid);
    for (const rec of this.records.values()) {
      rec.engine.removeAllListeners();
      if (
        typeof (rec.engine as unknown as { dispose?: () => void }).dispose ===
        "function"
      ) {
        (rec.engine as unknown as { dispose: () => void }).dispose!();
      }
    }
    this.records.clear();
  }
}

let singleton: PlayerRouter | null = null;
let override: PlayerRouter | null = null;

export function setGlobalPlayerRouter(r: PlayerRouter): void {
  singleton = r;
}
export function routerOverrideForTests(r: PlayerRouter | null): void {
  override = r;
}
export function resolvePlayerRouter(): PlayerRouter {
  if (override) return override;
  if (singleton) return singleton;
  throw new Error("PlayerRouter not initialized");
}
