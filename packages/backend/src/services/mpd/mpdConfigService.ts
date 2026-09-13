import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { OutputMode } from "@repo/types";
import { checkTool } from "../utils/utils.js";

export interface MpdConfigService {
  // ConfigService
  getConfig(): { content: string; path: string };
  updateConfig(content: string): { success: boolean; warning?: string };
  ensureFollowOutsideSymlinks(): { success: boolean; warning?: string };
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
  stopMPD(): { success: boolean; warning?: string };
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
  private readonly FOLLOW_OUTSIDE_SYMLINKS = 'follow_outside_symlinks "yes"';

  private _currentOutputMode: OutputMode = "mpd";
  private _lastDeviceName: string | null = null;
  private _mpdOwnerSessionId: string | null = null;

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

  public ensureFollowOutsideSymlinks(): {
    success: boolean;
    warning?: string;
  } {
    const { content } = this.getConfig();
    if (content.includes("follow_outside_symlinks")) {
      return { success: true };
    }
    const trimmed = content ? content.replace(/\s+$/, "") + "\n" : "";
    const updated = `${trimmed}# Allow MPD to follow symlinks to local storage folders (managed by Sonect)\n${this.FOLLOW_OUTSIDE_SYMLINKS}\n`;
    try {
      fs.mkdirSync(path.dirname(this.MPD_CONFIG_PATH), { recursive: true });
      fs.writeFileSync(this.MPD_CONFIG_PATH, updated, "utf-8");
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

  public restartMPD(): { success: boolean; warning?: string } {
    if (checkTool("systemctl")) {
      try {
        execSync("sudo systemctl restart mpd", {
          stdio: "ignore",
          timeout: 10000,
        });
        return { success: true };
      } catch {
        return {
          success: true,
          warning: "Config saved but MPD restart failed. Restart MPD manually.",
        };
      }
    }
    if (checkTool("service")) {
      try {
        execSync("service mpd restart", { stdio: "ignore", timeout: 10000 });
        return { success: true };
      } catch {
        return {
          success: true,
          warning: "Config saved but MPD restart failed. Restart MPD manually.",
        };
      }
    }
    return {
      success: true,
      warning: "Config saved. Restart MPD manually for changes to take effect.",
    };
  }

  public stopMPD(): { success: boolean; warning?: string } {
    if (checkTool("systemctl")) {
      try {
        execSync("sudo systemctl stop mpd", {
          stdio: "ignore",
          timeout: 10000,
        });
        return { success: true };
      } catch {
        return {
          success: true,
          warning: "Failed to stop MPD. Try stopping MPD manually.",
        };
      }
    }
    if (checkTool("service")) {
      try {
        execSync("service mpd stop", { stdio: "ignore", timeout: 10000 });
        return { success: true };
      } catch {
        return {
          success: true,
          warning: "Failed to stop MPD. Try stopping MPD manually.",
        };
      }
    }
    return {
      success: false,
      warning: "Neither systemctl nor service is available on this system.",
    };
  }

  public getMpdStatus(): {
    running: boolean;
    pid?: string;
    error?: string;
  } {
    if (checkTool("systemctl")) {
      try {
        execSync("systemctl is-active --quiet mpd", {
          stdio: "ignore",
          timeout: 5000,
        });
        return { running: true };
      } catch {
        return { running: false };
      }
    }
    try {
      const pid = execSync("pgrep -x mpd", {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      return { running: true, pid: pid || undefined };
    } catch {
      return { running: false };
    }
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

// Backward compat aliases
export type ConfigService = Pick<
  MpdConfigService,
  | "getConfig"
  | "updateConfig"
  | "ensureFollowOutsideSymlinks"
  | "getConfigPath"
  | "restartMpdInternal"
>;
export type AudioService = Pick<
  MpdConfigService,
  | "getCurrentAudioOutput"
  | "configureAudioOutput"
  | "restartMPD"
  | "stopMPD"
  | "getMpdStatus"
  | "setOutputMode"
  | "getOutputMode"
  | "getOutputDeviceName"
>;
export const ConfigServiceImpl = MpdConfigServiceImpl;
export const AudioServiceImpl = MpdConfigServiceImpl;
