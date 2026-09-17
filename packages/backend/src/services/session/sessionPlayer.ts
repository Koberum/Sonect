import { EventEmitter } from "events";
import { tracksDb } from "@repo/db";
import type { LogService } from "@services/utils/logService";
import type { PlaybackStatus, SessionQueueEntry } from "@repo/types";
import type { Track, TrackWithRelations } from "@repo/types/catalog";
import { AutoplayService } from "../mpd/autoplayService.js";

export class SessionPlayer extends EventEmitter {
  private queueInternal: SessionQueueEntry[] = [];
  private indexInternal = -1;
  private position = 0;
  private stateInternal: "play" | "pause" | "stop" = "stop";
  private lastActiveAtInternal = Date.now();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private readonly autoplayService: AutoplayService;
  private _autofillInProgress = false;

  constructor(
    private readonly sessionId: string,
    private readonly logService: LogService,
    autoplayService?: AutoplayService,
  ) {
    super();
    this.autoplayService = autoplayService ?? new AutoplayService();
  }

  private log(
    level: Parameters<LogService["pushLog"]>[0],
    msg: string,
    data?: unknown,
  ): void {
    try {
      this.logService?.pushLog?.(level, msg, data);
    } catch {
      // ignore in tests with stub logService
    }
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
    } else {
      this.maybeRefill();
    }
    this.emit("stateChanged");
  }

  private maybeRefill(): void {
    if (this._autofillInProgress) return;
    const remaining = this.queueInternal.length - this.indexInternal - 1;
    if (remaining >= 5 || remaining < 0) return;
    const current = this.queueInternal[this.indexInternal];
    if (!current) return;
    const queuedFiles = this.queueInternal.map((e) => e.file);
    this._autofillInProgress = true;
    try {
      const batch = this.autoplayService.getNextBatch(current.file, {
        queuedFiles,
      });
      if (batch.length > 0) {
        const sid = this.autoplayService.sessionId;
        for (const f of batch) {
          const t = tracksDb.getByFile(f);
          if (t) this.queueInternal.push(this.buildEntry(t));
        }
        this.autoplayService.commitBatch(batch, sid);
        this.log(
          "debug",
          `[Session ${this.sessionId.slice(0, 8)}][browser] autoplay refill +${batch.length} queueLen=${this.queueInternal.length}`,
          { queueLength: this.queueInternal.length },
        );
      }
    } catch (err) {
      this.log("error", `autoplay refill failed: ${String(err)}`, {
        error: String(err),
      });
    } finally {
      this._autofillInProgress = false;
    }
  }

  private buildEntry(t: Track): SessionQueueEntry {
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
    this.maybeRefill();
  }

  private currentTrack(): TrackWithRelations | undefined {
    const entry = this.queueInternal[this.indexInternal];
    if (!entry) return undefined;
    const rel = (tracksDb.getByIdWithRelations(entry.id) ??
      tracksDb.getById(entry.id)) as TrackWithRelations | undefined;
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
      this.log(
        "warn",
        `[Session ${this.sessionId.slice(0, 8)}][browser] play unknown track '${file}'`,
        { sessionId: this.sessionId.slice(0, 8), file },
      );
      return;
    }

    let entries: SessionQueueEntry[];
    let initialFiles: string[];
    if (dbTrack.album_id) {
      const albumTracks = tracksDb.getByAlbumOrdered(dbTrack.album_id);
      const clickIdx = albumTracks.findIndex((t) => t.file === file);
      const files = clickIdx >= 0 ? albumTracks.slice(clickIdx) : [dbTrack];
      entries = files.map((t) => this.buildEntry(t));
      initialFiles = files.map((t) => t.file);
    } else {
      entries = [this.buildEntry(dbTrack)];
      initialFiles = [dbTrack.file];
    }

    this.queueInternal = entries;
    this.indexInternal = 0;
    this.position = 0;
    this.stateInternal = "play";
    this.startClock();

    const sessionId = this.autoplayService.resetSession(file, initialFiles);
    try {
      const batchFiles = this.autoplayService.getNextBatch(file);
      if (
        batchFiles.length > 0 &&
        this.autoplayService.sessionId === sessionId
      ) {
        for (const f of batchFiles) {
          const t = tracksDb.getByFile(f);
          if (t) this.queueInternal.push(this.buildEntry(t));
        }
        this.autoplayService.commitBatch(batchFiles, sessionId);
      }
    } catch (err) {
      this.log("error", `autoplay batch failed: ${String(err)}`, {
        error: String(err),
      });
    }

    this.log(
      "debug",
      `[Session ${this.sessionId.slice(0, 8)}][browser] play file="${file}" queueLen=${this.queueInternal.length}`,
      {
        sessionId: this.sessionId.slice(0, 8),
        file,
        queueLength: this.queueInternal.length,
      },
    );
    this.emit("stateChanged");
  }

  pause(): void {
    if (this.state !== "play") return;
    this.stateInternal = "pause";
    this.stopClock();
    this.log(
      "debug",
      `[Session ${this.sessionId.slice(0, 8)}][browser] pause at ${this.position}s`,
      {
        sessionId: this.sessionId.slice(0, 8),
        position: this.position,
      },
    );
    this.emit("stateChanged");
  }

  resume(): void {
    if (this.queueInternal.length === 0) {
      this.log(
        "debug",
        `[Session ${this.sessionId.slice(0, 8)}][browser] resume ignored: empty queue`,
        {
          sessionId: this.sessionId.slice(0, 8),
        },
      );
      return;
    }
    if (this.indexInternal < 0) this.indexInternal = 0;
    this.stateInternal = "play";
    this.startClock();
    this.log(
      "debug",
      `[Session ${this.sessionId.slice(0, 8)}][browser] resume at ${this.position}s queueLen=${this.queueInternal.length}`,
      {
        sessionId: this.sessionId.slice(0, 8),
        position: this.position,
        queueLength: this.queueInternal.length,
      },
    );
    this.emit("stateChanged");
  }

  next(): void {
    if (this.queueInternal.length === 0) {
      this.log(
        "debug",
        `[Session ${this.sessionId.slice(0, 8)}][browser] next ignored: empty queue`,
        {
          sessionId: this.sessionId.slice(0, 8),
        },
      );
      return;
    }
    const prevIdx = this.indexInternal;
    this.advance();
    this.log(
      "debug",
      `[Session ${this.sessionId.slice(0, 8)}][browser] next ${prevIdx}→${this.indexInternal} state=${this.stateInternal}`,
      {
        sessionId: this.sessionId.slice(0, 8),
        from: prevIdx,
        to: this.indexInternal,
        state: this.stateInternal,
      },
    );
    if (this.stateInternal === "stop") {
      // Queue end reached: emit so WS consumers observe the final stop.
      this.emit("stateChanged");
      return;
    }
    this.stateInternal = "play";
    this.startClock();
    this.emit("stateChanged");
  }

  previous(): void {
    if (this.queueInternal.length === 0) return;
    const prevIdx = this.indexInternal;
    if (this.indexInternal > 0) {
      this.indexInternal -= 1;
    }
    this.position = 0;
    if (this.queueInternal.length > 0) this.stateInternal = "play";
    this.startClock();
    this.log(
      "debug",
      `[Session ${this.sessionId.slice(0, 8)}][browser] previous ${prevIdx}→${this.indexInternal}`,
      {
        sessionId: this.sessionId.slice(0, 8),
        from: prevIdx,
        to: this.indexInternal,
      },
    );
    this.emit("stateChanged");
  }

  seek(position: number): void {
    const current = this.queueInternal[this.indexInternal];
    if (!current) {
      this.log(
        "debug",
        `[Session ${this.sessionId.slice(0, 8)}][browser] seek ignored: no current track`,
        {
          sessionId: this.sessionId.slice(0, 8),
        },
      );
      return;
    }
    const clamped = Math.max(0, Math.min(position, current.duration));
    this.position = clamped;
    this.log(
      "debug",
      `[Session ${this.sessionId.slice(0, 8)}][browser] seek ${position}→${clamped}`,
      {
        sessionId: this.sessionId.slice(0, 8),
        requested: position,
        clamped,
      },
    );
    this.emit("stateChanged");
  }

  playPosition(pos: number): void {
    if (pos < 0 || pos >= this.queueInternal.length) return;
    const prevIdx = this.indexInternal;
    this.indexInternal = pos;
    this.position = 0;
    this.stateInternal = "play";
    this.startClock();
    this.log(
      "debug",
      `[Session ${this.sessionId.slice(0, 8)}][browser] playPosition ${prevIdx}→${this.indexInternal} file="${this.queueInternal[this.indexInternal]?.file}"`,
      {
        sessionId: this.sessionId.slice(0, 8),
        from: prevIdx,
        to: this.indexInternal,
        file: this.queueInternal[this.indexInternal]?.file,
      },
    );
    this.emit("stateChanged");
  }

  addToQueue(file: string): void {
    const t = tracksDb.getByFile(file);
    if (t) {
      this.queueInternal.push(this.buildEntry(t));
      this.log(
        "debug",
        `[Session ${this.sessionId.slice(0, 8)}][browser] addToQueue file="${file}" queueLen=${this.queueInternal.length}`,
        {
          sessionId: this.sessionId.slice(0, 8),
          file,
          queueLength: this.queueInternal.length,
        },
      );
      this.emit("stateChanged");
    } else {
      this.log(
        "warn",
        `[Session ${this.sessionId.slice(0, 8)}][browser] addToQueue unknown file="${file}"`,
        {
          sessionId: this.sessionId.slice(0, 8),
          file,
        },
      );
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
      } else {
        // Mid-queue: the item that followed the removed one is now current at
        // `pos` — start it from the beginning.
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
