import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { OutputMode } from "@repo/types";
import { checkTool } from "@services/utils/utils";

export interface AudioService {
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
}

export class AudioServiceImpl implements AudioService {
  private readonly mpdConfigPath =
    process.env.MPD_CONFIG_PATH ?? "/opt/sonect/data/mpd-audio.conf";

  private _currentOutputMode: OutputMode = "mpd";
  private _lastAlsaConfig: string | null = null;
  private _lastDeviceName: string | null = null;

  public getCurrentAudioOutput(): {
    card: string;
    name: string;
  } | null {
    try {
      const config = fs.readFileSync(this.mpdConfigPath, "utf-8");
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

    const dir = path.dirname(this.mpdConfigPath);

    if (!fs.existsSync(this.mpdConfigPath)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          this.mpdConfigPath,
          "# This file is managed by the Sonect frontend.\n# It is owned by the service user, so no sudo is needed for edits.\n\n" +
            newOutput +
            "\n",
          "utf-8",
        );
      } catch {
        return {
          success: false,
          warning: `Cannot write to ${this.mpdConfigPath}. Check file permissions.`,
        };
      }

      const restartResult = this.restartMPD();
      return { success: true, warning: restartResult.warning };
    }

    let config: string;
    try {
      config = fs.readFileSync(this.mpdConfigPath, "utf-8");
    } catch {
      return {
        success: false,
        warning: `Cannot read ${this.mpdConfigPath}. File may not exist.`,
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
      fs.writeFileSync(this.mpdConfigPath, config, "utf-8");
    } catch {
      return {
        success: false,
        warning: `Cannot write to ${this.mpdConfigPath}. Check file permissions.`,
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

  public setOutputMode(mode: OutputMode): {
    success: boolean;
    warning?: string;
  } {
    if (mode === this._currentOutputMode) {
      return { success: true };
    }

    const dir = path.dirname(this.mpdConfigPath);

    if (mode === "browser") {
      const currentAlsa = this.getCurrentAudioOutput();
      if (currentAlsa) {
        this._lastDeviceName = currentAlsa.name;
        this._lastAlsaConfig = [
          `audio_output {`,
          `    type        "alsa"`,
          `    name        "${currentAlsa.name}"`,
          `    device      "${currentAlsa.card}"`,
          `    mixer_type  "software"`,
          `}`,
        ].join("\n");
      }

      const nullConfig = [
        `audio_output {`,
        `    type        "null"`,
        `    name        "Browser Mode (Silent)"`,
        `}`,
      ].join("\n");

      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(
          this.mpdConfigPath,
          "# This file is managed by the Sonect frontend.\n# Browser output mode — MPD plays silently.\n\n" +
            nullConfig +
            "\n",
          "utf-8",
        );
      } catch {
        return {
          success: false,
          warning: `Cannot write to ${this.mpdConfigPath}.`,
        };
      }
    } else {
      this._lastDeviceName = null;
      if (this._lastAlsaConfig) {
        try {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(
            this.mpdConfigPath,
            "# This file is managed by the Sonect frontend.\n\n" +
              this._lastAlsaConfig +
              "\n",
            "utf-8",
          );
        } catch {
          return {
            success: false,
            warning: `Cannot write to ${this.mpdConfigPath}.`,
          };
        }
      }
    }

    this._currentOutputMode = mode;
    const restartResult = this.restartMPD();
    return { success: true, warning: restartResult.warning };
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

  public checkTool(name: string): boolean {
    try {
      execSync(`which ${name}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }
}
