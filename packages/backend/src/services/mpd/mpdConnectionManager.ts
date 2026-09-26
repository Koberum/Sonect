import { EventEmitter } from "events";
import net from "net";
import mpd from "mpd";
import type { PlaybackStatus, PlaybackState } from "@repo/types";
import type { CatalogService } from "@services/library/catalogService";
import type { LogService } from "@services/utils/logService";
import { parseKeyValue, hashFile } from "../../utils/mpd.js";
import { TrackWithRelations } from "@repo/types/catalog";

const { cmd } = mpd;

const MPD_HOST = process.env.MPD_HOST ?? "localhost";
const MPD_PORT = parseInt(process.env.MPD_PORT ?? "6600", 10);

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const POLL_INTERVAL_PLAY_MS = 2_000;
const POLL_INTERVAL_IDLE_MS = 10_000;
const AUTOPLAY_REFILL_INTERVAL_MS = 10_000;
const AUTOPLAY_QUEUE_LOW = 5;

type MPDClient = ReturnType<typeof mpd.connect>;

function createDefaultStatus(): PlaybackStatus {
  return {
    state: "stop",
    elapsed: 0,
    duration: 0,
    volume: 0,
    repeat: false,
    random: false,
    single: false,
    consume: false,
    queueLength: 0,
  };
}

export class MpdConnectionManager extends EventEmitter {
  constructor(
    private catalogService: CatalogService,
    private logService: LogService,
  ) {
    super();
  }

  private cmdClient: MPDClient | null = null;
  private pollSocket: net.Socket | null = null;
  private _cache: PlaybackStatus = createDefaultStatus();
  private _cmdConnected = false;
  private _pollConnected = false;
  private _running = false;
  private _cmdReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _pollReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _cmdReconnectDelay = RECONNECT_BASE_MS;
  private _pollReconnectDelay = RECONNECT_BASE_MS;
  private _pollTimer: ReturnType<typeof setInterval> | null = null;
  private _lastSongId: number | null = null;
  private _refreshInProgress = false;
  private _autoplayCallback: ((currentFile: string) => Promise<void>) | null =
    null;
  private _lastAutofillTime = 0;
  private _autofillInProgress = false;
  private pollBuffer = "";
  private _pollResolve: ((value: string) => void) | null = null;
  private _pollReject: ((err: Error) => void) | null = null;
  private _pollPending = false;

  get connected(): boolean {
    return this._cmdConnected;
  }

  getCmdClient(): MPDClient | null {
    return this.cmdClient;
  }

  setAutoplayCallback(cb: (currentFile: string) => Promise<void>): void {
    this._autoplayCallback = cb;
  }

  getCachedStatus(): PlaybackStatus {
    return { ...this._cache };
  }

  async executeCommand(command: string, args: string[] = []): Promise<string> {
    console.log(`[MPD] Executing command: ${command} ${args.join(" ")}`);
    this.logService.pushLog("info", `MPD cmd: ${command} ${args.join(" ")}`);

    if (!this._cmdConnected || !this.cmdClient) {
      throw new Error("MPD connection not available");
    }

    return new Promise((resolve, reject) => {
      this.cmdClient!.sendCommand(
        cmd(command, args),
        (err: any, msg: string) => {
          if (err) reject(err instanceof Error ? err : new Error(String(err)));
          else resolve(msg);
        },
      );
    });
  }

  async executeCommandList(
    commands: { command: string; args?: string[] }[],
  ): Promise<string> {
    if (!this._cmdConnected || !this.cmdClient) {
      throw new Error("MPD connection not available");
    }

    const lines = [
      "command_list_begin",
      ...commands.map((c) => cmd(c.command, c.args || [])),
      "command_list_end",
    ].join("\n");

    return new Promise((resolve, reject) => {
      this.cmdClient!.sendCommand(lines, (err: any, msg: string) => {
        if (err) reject(err instanceof Error ? err : new Error(String(err)));
        else resolve(msg);
      });
    });
  }

  async refreshNow(): Promise<void> {
    await this.refreshFullCache();
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.connectCmd();
    this.connectPoll();
  }

  stop(): void {
    this._running = false;
    this.stopPolling();
    this.clearTimers();
    this.destroyClient(this.cmdClient);
    this.destroySocket();
    this.cmdClient = null;
    this.pollSocket = null;
    this._cmdConnected = false;
    this._pollConnected = false;
  }

  private clearTimers(): void {
    if (this._cmdReconnectTimer) {
      clearTimeout(this._cmdReconnectTimer);
      this._cmdReconnectTimer = null;
    }
    if (this._pollReconnectTimer) {
      clearTimeout(this._pollReconnectTimer);
      this._pollReconnectTimer = null;
    }
  }

  private destroyClient(client: MPDClient | null): void {
    if (!client) return;
    try {
      client.socket.end();
    } catch {
      this.logService.pushLog("error", "Failed to destroy MPD client socket");
    }
    client.removeAllListeners();
  }

  private destroySocket(): void {
    if (!this.pollSocket) return;
    try {
      this.pollSocket.end();
    } catch {
      this.logService.pushLog("error", "Failed to destroy MPD poll socket");
    }
    this.pollSocket.removeAllListeners();
  }

  private connectCmd(): void {
    if (!this._running) return;

    try {
      const client = mpd.connect({ host: MPD_HOST, port: MPD_PORT });
      this.cmdClient = client;

      client.on("ready", () => {
        console.log("[MPD] Command connection ready");
        this.logService.pushLog("info", "MPD command connection ready");
        this._cmdConnected = true;
        this._cmdReconnectDelay = RECONNECT_BASE_MS;
      });

      client.on("end", () => {
        console.log("[MPD] Command connection closed");
        this.logService.pushLog("warn", "MPD command connection closed");
        this._cmdConnected = false;
        this.scheduleReconnectCmd();
      });

      client.on("error", (err: Error) => {
        console.error("[MPD] Command connection error:", err.message);
        this.logService.pushLog(
          "error",
          `MPD command connection error: ${err.message}`,
        );
      });
    } catch (err) {
      console.error("[MPD] Command connection failed:", err);
      this.logService.pushLog(
        "error",
        `MPD command connection failed: ${String(err)}`,
      );
      this.scheduleReconnectCmd();
    }
  }

  private connectPoll(): void {
    if (!this._running) return;

    try {
      const socket = net.createConnection({ host: MPD_HOST, port: MPD_PORT });
      socket.setEncoding("utf8");
      this.pollSocket = socket;
      this.pollBuffer = "";

      socket.on("data", (data: string) => {
        this.pollBuffer += data;

        if (!this._pollConnected) {
          const greetingEnd = this.pollBuffer.indexOf("\n");
          if (greetingEnd !== -1) {
            const greeting = this.pollBuffer.substring(0, greetingEnd);
            this.pollBuffer = this.pollBuffer.substring(greetingEnd + 1);

            if (greeting.startsWith("OK MPD ")) {
              console.log("[MPD] Poll connection ready");
              this.logService.pushLog("info", "MPD poll connection ready");
              this._pollConnected = true;
              this._pollReconnectDelay = RECONNECT_BASE_MS;

              this.processPollBuffer();

              this.refreshFullCache().then(() => this.startPolling());
            } else {
              console.error(`[MPD] Invalid greeting: ${greeting}`);
              this.logService.pushLog(
                "error",
                `Invalid MPD greeting: ${greeting}`,
              );
              socket.end();
              this.pollSocket = null;
              this.scheduleReconnectPoll();
            }
          }
        } else {
          this.processPollBuffer();
        }
      });

      socket.on("close", () => {
        console.log("[MPD] Poll connection closed");
        this.logService.pushLog("warn", "MPD poll connection closed");
        this._pollConnected = false;
        this.stopPolling();
        const reject = this._pollReject;
        this._pollReject = null;
        this._pollResolve = null;
        this._pollPending = false;
        reject?.(new Error("Connection closed"));
        this.emit("disconnected");
        this.scheduleReconnectPoll();
      });

      socket.on("error", (err: Error) => {
        console.error("[MPD] Poll connection error:", err.message);
        this.logService.pushLog(
          "error",
          `MPD poll connection error: ${err.message}`,
        );
      });
    } catch (err) {
      console.error("[MPD] Poll connection failed:", err);
      this.logService.pushLog(
        "error",
        `MPD poll connection failed: ${String(err)}`,
      );
      this.scheduleReconnectPoll();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    const interval =
      this._cache.state === "play"
        ? POLL_INTERVAL_PLAY_MS
        : POLL_INTERVAL_IDLE_MS;
    this._pollTimer = setInterval(() => this.refreshFullCache(), interval);
  }

  private stopPolling(): void {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  private async refreshFullCache(): Promise<void> {
    if (!this._pollConnected || !this.pollSocket || this._refreshInProgress)
      return;
    this._refreshInProgress = true;

    try {
      const prevState = this._cache.state;

      const rawStatus = await this.executeOnPollClient("status");
      const status = parseKeyValue(rawStatus);

      let resolvedTrack: TrackWithRelations | undefined;
      const currentSongId = parseInt(status.songid, 10);

      if (!isNaN(currentSongId)) {
        if (currentSongId === this._lastSongId) {
          resolvedTrack = this._cache.track;
        } else {
          this._lastSongId = currentSongId;

          try {
            const rawSong = await this.executeOnPollClient("currentsong");
            const song = parseKeyValue(rawSong);

            if (song.file && song.Artist && song.Album && song.Title) {
              resolvedTrack =
                this.catalogService.resolveTrack(
                  song.Artist,
                  song.Album,
                  song.Title,
                ) ?? undefined;
            }

            if (!resolvedTrack && song.file) {
              resolvedTrack = {
                id: hashFile(song.file),
                file: song.file,
                title: song.Title || "Unknown",
                artist_name: song.Artist || "Unknown",
                cover_path: "",
              };
            }
          } catch {
            this.logService.pushLog("error", "Failed to resolve current song");
          }
          if (resolvedTrack) {
            this.emit("trackChanged", resolvedTrack);
          }
        }
      }

      const playlistLength = parseInt(status.playlistlength ?? "0", 10) || 0;
      const songPosition = parseInt(status.song ?? "-1", 10);
      const remainingTracks =
        songPosition >= 0 ? playlistLength - songPosition : playlistLength;

      this._cache = {
        state: (status.state as PlaybackState) || "stop",
        elapsed: parseFloat(status.elapsed ?? "0") || 0,
        duration: parseFloat(status.duration ?? "0") || 0,
        volume: parseInt(status.volume ?? "0", 10) || 0,
        repeat: status.repeat === "1",
        random: status.random === "1",
        single: status.single === "1",
        consume: status.consume === "1",
        track: resolvedTrack ?? undefined,
        queueLength: playlistLength,
      };

      if (this._cache.state !== prevState) {
        this.startPolling();
      }

      this.emit("stateChanged", this._cache);

      if (
        remainingTracks > 0 &&
        remainingTracks < AUTOPLAY_QUEUE_LOW &&
        this._autoplayCallback &&
        !this._autofillInProgress &&
        this._cache.track?.file &&
        Date.now() - this._lastAutofillTime > AUTOPLAY_REFILL_INTERVAL_MS
      ) {
        this._lastAutofillTime = Date.now();
        this._autofillInProgress = true;
        Promise.resolve(this._autoplayCallback(this._cache.track.file))
          .catch((err) => {
            console.error("[MPD] Autoplay fill failed:", err);
            this.logService.pushLog(
              "error",
              `Autoplay fill failed: ${String(err)}`,
            );
          })
          .finally(() => {
            this._autofillInProgress = false;
          });
      }
    } catch (err) {
      console.error("[MPD] Failed to refresh cache:", err);
      this.logService.pushLog(
        "error",
        `Failed to refresh cache: ${String(err)}`,
      );
    } finally {
      this._refreshInProgress = false;
    }
  }

  private processPollBuffer(): void {
    const sentinel = /^(OK|ACK)(.*)$/m;
    let m: RegExpMatchArray | null;

    while ((m = this.pollBuffer.match(sentinel))) {
      const msg = this.pollBuffer.substring(0, m.index);
      const line = m[0];
      const code = m[1];
      const str = m[2];
      this.pollBuffer = this.pollBuffer.substring(msg.length + line.length + 1);

      if (code === "ACK") {
        const reject = this._pollReject;
        this._pollReject = null;
        this._pollResolve = null;
        this._pollPending = false;
        reject?.(new Error(str.trim()));
      } else {
        const resolve = this._pollResolve;
        this._pollReject = null;
        this._pollResolve = null;
        this._pollPending = false;
        resolve?.(msg);
      }
    }
  }

  private executeOnPollClient(
    command: string,
    args: string[] = [],
  ): Promise<string> {
    if (!this.pollSocket || !this._pollConnected) {
      return Promise.reject(new Error("Poll client not connected"));
    }

    if (this._pollPending) {
      return Promise.reject(new Error("Poll command already in progress"));
    }

    return new Promise((resolve, reject) => {
      this._pollResolve = resolve;
      this._pollReject = reject;
      this._pollPending = true;

      const cmdStr =
        args.length > 0
          ? `${command} ${args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ")}\n`
          : `${command}\n`;

      this.pollSocket!.write(cmdStr);
    });
  }

  private scheduleReconnectCmd(): void {
    if (!this._running || this._cmdReconnectTimer) return;

    console.log(
      `[MPD] Reconnecting command in ${this._cmdReconnectDelay}ms ...`,
    );
    this.logService.pushLog(
      "warn",
      `MPD cmd reconnecting in ${this._cmdReconnectDelay}ms`,
    );
    this._cmdReconnectTimer = setTimeout(() => {
      this._cmdReconnectTimer = null;
      this._cmdReconnectDelay = Math.min(
        this._cmdReconnectDelay * 2,
        RECONNECT_MAX_MS,
      );

      this.destroyClient(this.cmdClient);
      this.cmdClient = null;
      this.connectCmd();
    }, this._cmdReconnectDelay);
  }

  private scheduleReconnectPoll(): void {
    if (!this._running || this._pollReconnectTimer) return;

    console.log(`[MPD] Reconnecting poll in ${this._pollReconnectDelay}ms ...`);
    this.logService.pushLog(
      "warn",
      `MPD poll reconnecting in ${this._pollReconnectDelay}ms`,
    );
    this._pollReconnectTimer = setTimeout(() => {
      this._pollReconnectTimer = null;
      this._pollReconnectDelay = Math.min(
        this._pollReconnectDelay * 2,
        RECONNECT_MAX_MS,
      );

      this.destroySocket();
      this.pollSocket = null;
      this.connectPoll();
    }, this._pollReconnectDelay);
  }
}
