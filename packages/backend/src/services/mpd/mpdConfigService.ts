import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { OutputMode } from "@repo/types";
import type { MpdConnectionManager } from "./mpdConnectionManager.js";

/**
 * Reload MPD after the drop-in changed. Under s6 (single-container image) it
 * asks the supervisor to restart the service; in dev it sends SIGHUP to the
 * MPD process. Both are unprivileged — no `sudo`, no `systemctl`.
 */
function defaultReload(): void {
  if (fs.existsSync("/run/service/mpd")) {
    execSync("s6-svc -r /run/service/mpd");
  } else {
    execSync("pkill -HUP mpd");
  }
}

export interface MpdConfigService {
  // ConfigService
  getConfig(): { content: string; path: string };
  updateConfig(content: string): { success: boolean; warning?: string };
  getConfigPath(): string;
  restartMpdInternal(): { success: boolean; warning?: string };
  // AudioService
  getCurrentAudioOutput(): { card: string; name: string } | null;
  configureAudioOutput(params: {
    card: string;
    name: string;
    mixerType?: "hardware" | "software" | "none";
  }): { success: boolean; warning?: string };
  restartMPD(): { success: boolean; warning?: string };
  getMpdStatus(): {
    running: boolean;
    pid?: string;
    error?: string;
  };
  setOutputMode(mode: OutputMode): { success: boolean; warning?: string };
  getOutputMode(): OutputMode;
  getOutputDeviceName(): string | null;
  getMpdOwner(): string | null;
  tryAcquireMpd(sessionId: string): { success: boolean; owner?: string };
  releaseMpd(sessionId: string): boolean;
  isMpdLockedByOther(sessionId: string): boolean;
}

export class MpdConfigServiceImpl implements MpdConfigService {
  private readonly MPD_CONFIG_PATH =
    process.env.MPD_CONFIG_PATH ?? "/opt/sonect/data/mpd-audio.conf";

  private _currentOutputMode: OutputMode = "mpd";
  private _lastDeviceName: string | null = null;
  private _mpdOwnerSessionId: string | null = null;

  constructor(
    private readonly mpdConnectionManager: MpdConnectionManager,
    private readonly reload: () => void = defaultReload,
  ) {}

  // ConfigService
  public getConfig(): { content: string; path: string } {
    if (!fs.existsSync(this.MPD_CONFIG_PATH)) {
      try {
        fs.mkdirSync(path.dirname(this.MPD_CONFIG_PATH), { recursive: true });
        fs.writeFileSync(
          this.MPD_CONFIG_PATH,
          "# This file is managed by the Sonect frontend.\n# It is owned by the service user, so no sudo is needed for edits.\n",
          "utf-8",
        );
      } catch {
        return { content: "", path: this.MPD_CONFIG_PATH };
      }
    }
    try {
      const content = fs.readFileSync(this.MPD_CONFIG_PATH, "utf-8");
      return { content, path: this.MPD_CONFIG_PATH };
    } catch {
      return { content: "", path: this.MPD_CONFIG_PATH };
    }
  }

  public updateConfig(content: string): {
    success: boolean;
    warning?: string;
  } {
    try {
      fs.mkdirSync(path.dirname(this.MPD_CONFIG_PATH), { recursive: true });
      fs.writeFileSync(this.MPD_CONFIG_PATH, content, "utf-8");
    } catch {
      return {
        success: false,
        warning: `Cannot write to ${this.MPD_CONFIG_PATH}. Check file permissions.`,
      };
    }
    return this.restartMpdInternal();
  }

  public getConfigPath(): string {
    return this.MPD_CONFIG_PATH;
  }

  public restartMpdInternal(): { success: boolean; warning?: string } {
    return this.restartMPD();
  }

  // AudioService
  public getCurrentAudioOutput(): {
    card: string;
    name: string;
  } | null {
    try {
      const config = fs.readFileSync(this.MPD_CONFIG_PATH, "utf-8");
      const match = config.match(/audio_output\s*\{[^}]*\}/s);
      if (!match) return null;
      const device = match[0].match(/device\s+"([^"]+)"/)?.[1];
      const name = match[0].match(/name\s+"([^"]+)"/)?.[1];
      if (!device) return null;
      return { card: device, name: name ?? "Audio Output" };
    } catch {
      return null;
    }
  }

  public configureAudioOutput(params: {
    card: string;
    name: string;
    mixerType?: "hardware" | "software" | "none";
  }): { success: boolean; warning?: string } {
    const { card, name, mixerType = "software" } = params;
    const newOutput = [
      `audio_output {`,
      `    type        "alsa"`,
      `    name        "${name}"`,
      `    device      "${card}"`,
      `    mixer_type  "${mixerType}"`,
      `}`,
    ].join("\n");
    const dir = path.dirname(this.MPD_CONFIG_PATH);
    if (!fs.existsSync(this.MPD_CONFIG_PATH)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          this.MPD_CONFIG_PATH,
          "# This file is managed by the Sonect frontend.\n# It is owned by the service user, so no sudo is needed for edits.\n\n" +
            newOutput +
            "\n",
          "utf-8",
        );
      } catch {
        return {
          success: false,
          warning: `Cannot write to ${this.MPD_CONFIG_PATH}. Check file permissions.`,
        };
      }
      const restartResult = this.restartMPD();
      return { success: true, warning: restartResult.warning };
    }
    let config: string;
    try {
      config = fs.readFileSync(this.MPD_CONFIG_PATH, "utf-8");
    } catch {
      return {
        success: false,
        warning: `Cannot read ${this.MPD_CONFIG_PATH}. File may not exist.`,
      };
    }
    const audioOutputRegex = /audio_output\s*\{[^}]*\}/gs;
    const existingMatch = config.match(audioOutputRegex);
    if (existingMatch) {
      config = config.replace(audioOutputRegex, newOutput);
    } else {
      config = config.trimEnd() + "\n\n" + newOutput + "\n";
    }
    try {
      fs.writeFileSync(this.MPD_CONFIG_PATH, config, "utf-8");
    } catch {
      return {
        success: false,
        warning: `Cannot write to ${this.MPD_CONFIG_PATH}. Check file permissions.`,
      };
    }
    const restartResult = this.restartMPD();
    return { success: true, warning: restartResult.warning };
  }

  /**
   * Reload MPD through the injected supervisor hook (s6 in the image, SIGHUP
   * in dev; tests inject a stub). The backend never runs `systemctl` or `sudo`.
   */
  public restartMPD(): { success: boolean; warning?: string } {
    try {
      this.reload();
    } catch (error) {
      return {
        success: false,
        warning: `Failed to reload MPD: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    return { success: true };
  }

  public getMpdStatus(): {
    running: boolean;
    pid?: string;
    error?: string;
  } {
    return { running: this.mpdConnectionManager.connected };
  }

  /**
   * Backcompat no-op: browser sessions run on a separate playback engine, so
   * MPD always stays on the physical speakers. The drop-in config file is
   * never rewritten. Kept for the GET/PUT /system/output-mode endpoints.
   */
  public setOutputMode(mode: OutputMode): {
    success: boolean;
    warning?: string;
  } {
    this._currentOutputMode = mode;
    return { success: true };
  }

  public getOutputMode(): OutputMode {
    return this._currentOutputMode;
  }

  public getOutputDeviceName(): string | null {
    if (this._currentOutputMode === "mpd") {
      const status = this.getCurrentAudioOutput();
      return status?.name ?? null;
    }
    return this._lastDeviceName;
  }

  public getMpdOwner(): string | null {
    return this._mpdOwnerSessionId;
  }

  public tryAcquireMpd(sessionId: string): {
    success: boolean;
    owner?: string;
  } {
    if (!sessionId)
      return { success: false, owner: this._mpdOwnerSessionId ?? undefined };
    if (this._mpdOwnerSessionId === null) {
      this._mpdOwnerSessionId = sessionId;
      return { success: true };
    }
    if (this._mpdOwnerSessionId === sessionId) return { success: true };
    return { success: false, owner: this._mpdOwnerSessionId };
  }

  public releaseMpd(sessionId: string): boolean {
    if (this._mpdOwnerSessionId === sessionId) {
      this._mpdOwnerSessionId = null;
      return true;
    }
    return false;
  }

  public isMpdLockedByOther(sessionId: string): boolean {
    return (
      this._mpdOwnerSessionId !== null && this._mpdOwnerSessionId !== sessionId
    );
  }
}
