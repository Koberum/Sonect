import type { PlaybackStatus, QueuedTrack } from "@repo/types";
import { PlayerServiceImpl } from "./playerService.js";
import { MpdConnectionManager } from "../mpd/mpdConnectionManager.js";
import type { LogService } from "../utils/logService.js";
import type { AutoplayService } from "../mpd/autoplayService.js";
import { EventEmitter } from "events";

export interface PlaybackEngine extends EventEmitter {
  getStatus(): PlaybackStatus;
  playTrack(file: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  seek(position: number): Promise<void>;
  getQueue(): Promise<QueuedTrack[]>;
  addToQueue(file: string): Promise<void>;
  removeFromQueue(pos: number): Promise<void>;
  moveQueueItem(from: number, to: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  playPosition(pos: number): Promise<void>;
  enableRandom(enabled: boolean): Promise<void>;
  enableRepeat(enabled: boolean): Promise<void>;
}

/**
 * Thin adapter over the global MPD queue (shared).
 * resume() uses explicit unpause (pause 0) instead of toggle.
 */
export class MpdAdapter extends EventEmitter implements PlaybackEngine {
  private statusForwarder: (() => void) | null = null;

  constructor(
    private readonly playerService: PlayerServiceImpl,
    private readonly mpdConnectionManager: MpdConnectionManager,
    private readonly logService: LogService,
    private readonly _autoplayService: AutoplayService,
    private readonly sessionId?: string,
  ) {
    super();
    this.statusForwarder = () => {
      this.emit("stateChanged");
    };
    this.mpdConnectionManager.on("stateChanged", this.statusForwarder);
  }

  private fmtSid(): string {
    return this.sessionId ? this.sessionId.slice(0, 8) : "unknown";
  }

  dispose(): void {
    if (this.statusForwarder) {
      this.mpdConnectionManager.off("stateChanged", this.statusForwarder);
      this.statusForwarder = null;
    }
  }

  getStatus(): PlaybackStatus {
    return this.playerService.getPlaybackStatus();
  }

  async playTrack(file: string): Promise<void> {
    this.logService?.pushLog?.(
      "debug",
      `[Session ${this.fmtSid()}][mpd] play file="${file}"`,
      {
        sessionId: this.fmtSid(),
        file,
        engine: "mpd",
      },
    );
    try {
      await this.playerService.playTrack(file);
    } catch (err) {
      this.logService?.pushLog?.(
        "error",
        `[Session ${this.fmtSid()}][mpd] play error: ${String(err)}`,
        {
          sessionId: this.fmtSid(),
          error: String(err),
        },
      );
      throw err;
    }
  }

  async pause(): Promise<void> {
    this.logService?.pushLog?.("debug", `[Session ${this.fmtSid()}][mpd] pause`, {
      sessionId: this.fmtSid(),
      engine: "mpd",
    });
    try {
      await this.playerService.pauseTrack();
    } catch (err) {
      this.logService?.pushLog?.(
        "error",
        `[Session ${this.fmtSid()}][mpd] pause error: ${String(err)}`,
        {
          sessionId: this.fmtSid(),
          error: String(err),
        },
      );
      throw err;
    }
  }

  async resume(): Promise<void> {
    this.logService?.pushLog?.(
      "debug",
      `[Session ${this.fmtSid()}][mpd] resume (pause 0)`,
      {
        sessionId: this.fmtSid(),
        engine: "mpd",
      },
    );
    try {
      // Explicit unpause — avoid toggle semantics of bare "pause"
      await this.mpdConnectionManager.executeCommand("pause", ["0"]);
      this.mpdConnectionManager.refreshNow().catch(() => {});
    } catch (err) {
      this.logService?.pushLog?.(
        "error",
        `[Session ${this.fmtSid()}][mpd] resume error: ${String(err)}`,
        {
          sessionId: this.fmtSid(),
          error: String(err),
        },
      );
      throw err;
    }
  }

  async next(): Promise<void> {
    this.logService?.pushLog?.("debug", `[Session ${this.fmtSid()}][mpd] next`, {
      sessionId: this.fmtSid(),
    });
    try {
      await this.playerService.nextTrack();
    } catch (err) {
      this.logService?.pushLog?.(
        "error",
        `[Session ${this.fmtSid()}][mpd] next error: ${String(err)}`,
        {
          sessionId: this.fmtSid(),
          error: String(err),
        },
      );
      throw err;
    }
  }

  async previous(): Promise<void> {
    this.logService?.pushLog?.(
      "debug",
      `[Session ${this.fmtSid()}][mpd] previous`,
      {
        sessionId: this.fmtSid(),
      },
    );
    try {
      await this.playerService.previousTrack();
    } catch (err) {
      this.logService?.pushLog?.(
        "error",
        `[Session ${this.fmtSid()}][mpd] previous error: ${String(err)}`,
        {
          sessionId: this.fmtSid(),
          error: String(err),
        },
      );
      throw err;
    }
  }

  async seek(position: number): Promise<void> {
    this.logService?.pushLog?.(
      "debug",
      `[Session ${this.fmtSid()}][mpd] seek position=${position}`,
      {
        sessionId: this.fmtSid(),
        position,
      },
    );
    try {
      await this.playerService.goToPosition(position);
    } catch (err) {
      this.logService?.pushLog?.(
        "error",
        `[Session ${this.fmtSid()}][mpd] seek error: ${String(err)}`,
        {
          sessionId: this.fmtSid(),
          error: String(err),
        },
      );
      throw err;
    }
  }

  async getQueue(): Promise<QueuedTrack[]> {
    return this.playerService.getQueue();
  }

  async addToQueue(file: string): Promise<void> {
    await this.playerService.addToQueue(file);
  }

  async removeFromQueue(pos: number): Promise<void> {
    await this.playerService.removeFromQueue(pos);
  }

  async moveQueueItem(from: number, to: number): Promise<void> {
    await this.playerService.moveQueueItem(from, to);
  }

  async setVolume(volume: number): Promise<void> {
    await this.playerService.setVolume(volume);
  }

  async playPosition(pos: number): Promise<void> {
    await this.playerService.playPosition(pos);
  }

  async enableRandom(enabled: boolean): Promise<void> {
    await this.playerService.enableRandom(enabled);
  }

  async enableRepeat(enabled: boolean): Promise<void> {
    await this.playerService.enableRepeat(enabled);
  }
}
