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
    private readonly _logService: LogService,
    private readonly _autoplayService: AutoplayService,
  ) {
    super();
    this.statusForwarder = () => {
      this.emit("stateChanged");
    };
    this.mpdConnectionManager.on("stateChanged", this.statusForwarder);
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
    await this.playerService.playTrack(file);
  }

  async pause(): Promise<void> {
    await this.playerService.pauseTrack();
  }

  async resume(): Promise<void> {
    // Explicit unpause — avoid toggle semantics of bare "pause"
    await this.mpdConnectionManager.executeCommand("pause", ["0"]);
    this.mpdConnectionManager.refreshNow().catch(() => {});
  }

  async next(): Promise<void> {
    await this.playerService.nextTrack();
  }

  async previous(): Promise<void> {
    await this.playerService.previousTrack();
  }

  async seek(position: number): Promise<void> {
    await this.playerService.goToPosition(position);
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
