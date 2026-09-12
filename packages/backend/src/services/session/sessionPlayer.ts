import { EventEmitter } from "events";
import { tracksDb } from "@repo/db";
import type { LogService } from "@services/utils/logService";
import type { DBTrack, DBTrackWithRelations } from "@repo/types";
import type {
  PlaybackStatus,
  SessionQueueEntry,
  TrackWithRelations,
} from "@repo/types";

export class SessionPlayer extends EventEmitter {
  private queueInternal: SessionQueueEntry[] = [];
  private indexInternal = -1;
  private position = 0;
  private stateInternal: "play" | "pause" | "stop" = "stop";
  private lastActiveAtInternal = Date.now();
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly sessionId: string,
    private readonly logService: LogService,
  ) {
    super();
  }

  get state(): "play" | "pause" | "stop" {
    return this.stateInternal;
  }

  touch(): void {
    this.lastActiveAtInternal = Date.now();
  }

  getLastActiveAt(): number {
    return this.lastActiveAtInternal;
  }

  stop(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private startClock(): void {
    if (this.tickTimer !== null) return;
    this.tickTimer = setInterval(() => this.tick(), 1000);
  }

  private stopClock(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  // Public test hook; the registry drives this via the interval.
  tick(): void {
    if (this.state !== "play" || this.indexInternal < 0) return;
    const current = this.queueInternal[this.indexInternal];
    if (!current) return;
    this.position += 1;
    if (this.position >= current.duration) {
      this.advance();
    }
    this.emit("stateChanged");
  }

  private buildEntry(t: DBTrack): SessionQueueEntry {
    const rel = tracksDb.getByIdWithRelations(t.id);
    return {
      id: t.id,
      file: t.file,
      title: t.title,
      artist_name: rel?.artist_name ?? "",
      album: rel?.album_title ?? "",
      duration: t.duration ?? 0,
      cover_path: rel?.cover_path ?? "",
    };
  }

  private advance(): void {
    const next = this.indexInternal + 1;
    if (next >= this.queueInternal.length) {
      this.stateInternal = "stop";
      this.indexInternal = -1;
      this.position = 0;
      this.stopClock();
      return;
    }
    this.indexInternal = next;
    this.position = 0;
  }

  private currentTrack(): TrackWithRelations | undefined {
    const entry = this.queueInternal[this.indexInternal];
    if (!entry) return undefined;
    const rel = (tracksDb.getByIdWithRelations(entry.id) ??
      tracksDb.getById(entry.id)) as DBTrackWithRelations | undefined;
    if (!rel) return undefined;
    return {
      ...rel,
      artist_name: rel.artist_name ?? entry.artist_name ?? "Unknown",
      album_title: entry.album,
      cover_path: rel.cover_path ?? entry.cover_path ?? "",
    } as TrackWithRelations;
  }

  getStatus(): PlaybackStatus {
    this.touch();
    return {
      state: this.stateInternal,
      elapsed: this.position,
      duration: this.queueInternal[this.indexInternal]?.duration ?? 0,
      volume: 100,
      repeat: false,
      random: false,
      single: false,
      consume: false,
      track: this.currentTrack(),
      queueLength: this.queueInternal.length,
    };
  }

  getQueue(): SessionQueueEntry[] {
    return this.queueInternal.map((e) => ({ ...e }));
  }

  playTrack(file: string): void {
    const dbTrack = tracksDb.getByFile(file);
    if (!dbTrack) {
      this.logService.pushLog(
        "warn",
        `Session ${this.sessionId}: unknown track '${file}'`,
      );
      return;
    }

    let entries: SessionQueueEntry[];
    if (dbTrack.album_id) {
      const albumTracks = tracksDb.getByAlbumOrdered(dbTrack.album_id);
      const clickIdx = albumTracks.findIndex((t) => t.file === file);
      const files = clickIdx >= 0 ? albumTracks.slice(clickIdx) : [dbTrack];
      entries = files.map((t) => this.buildEntry(t));
    } else {
      entries = [this.buildEntry(dbTrack)];
    }

    this.queueInternal = entries;
    this.indexInternal = 0;
    this.position = 0;
    this.stateInternal = "play";
    this.startClock();
    this.emit("stateChanged");
  }

  pause(): void {
    if (this.state !== "play") return;
    this.stateInternal = "pause";
    this.stopClock();
    this.emit("stateChanged");
  }

  resume(): void {
    if (this.queueInternal.length === 0) return;
    if (this.indexInternal < 0) this.indexInternal = 0;
    this.stateInternal = "play";
    this.startClock();
    this.emit("stateChanged");
  }

  next(): void {
    if (this.queueInternal.length === 0) return;
    this.advance();
    if (this.stateInternal === "stop") return;
    this.stateInternal = "play";
    this.startClock();
    this.emit("stateChanged");
  }

  previous(): void {
    if (this.indexInternal > 0) {
      this.indexInternal -= 1;
    }
    this.position = 0;
    if (this.queueInternal.length > 0) this.stateInternal = "play";
    this.startClock();
    this.emit("stateChanged");
  }

  seek(position: number): void {
    const current = this.queueInternal[this.indexInternal];
    if (!current) return;
    this.position = Math.max(0, Math.min(position, current.duration));
    this.emit("stateChanged");
  }

  addToQueue(file: string): void {
    const t = tracksDb.getByFile(file);
    if (t) {
      this.queueInternal.push(this.buildEntry(t));
      this.emit("stateChanged");
    }
  }

  removeFromQueue(pos: number): void {
    if (pos < 0 || pos >= this.queueInternal.length) return;
    const removing = pos;
    this.queueInternal.splice(pos, 1);
    if (this.indexInternal === removing) {
      // we removed the playing item -> move to the next (now at pos) or stop
      if (this.queueInternal.length === 0) {
        this.indexInternal = -1;
        this.stateInternal = "stop";
        this.position = 0;
        this.stopClock();
      } else if (this.indexInternal >= this.queueInternal.length) {
        this.indexInternal = this.queueInternal.length - 1;
        this.position = 0;
      }
    } else if (this.indexInternal > removing) {
      this.indexInternal -= 1;
    }
    this.emit("stateChanged");
  }

  moveQueueItem(from: number, to: number): void {
    if (from < 0 || from >= this.queueInternal.length) return;
    if (to < 0 || to > this.queueInternal.length) return;
    if (from === to) return;

    const [item] = this.queueInternal.splice(from, 1);
    this.queueInternal.splice(to, 0, item);

    if (this.indexInternal === from) {
      this.indexInternal = to;
      if (this.indexInternal >= this.queueInternal.length) {
        this.indexInternal = this.queueInternal.length - 1;
      }
    } else if (
      from < to &&
      this.indexInternal > from &&
      this.indexInternal <= to
    ) {
      // Moving an item forward shifts the playing item back one.
      this.indexInternal -= 1;
    } else if (
      from > to &&
      this.indexInternal >= to &&
      this.indexInternal < from
    ) {
      // Moving an item backward shifts the playing item forward one.
      this.indexInternal += 1;
    }
    this.emit("stateChanged");
  }
}
