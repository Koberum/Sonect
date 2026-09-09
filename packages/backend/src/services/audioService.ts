import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import type { OutputMode } from "@repo/types";
import { detectAudioDevices, type AudioDevice } from "./systemService";

interface AudioService {
  getAudioDevices(): AudioDevice[];
  getCurrentAudioOutput(): { card: string; name: string } | null;
  configureAudioOutput(params: {
    card: string;
    name: string;
    mixerType?: "hardware" | "software" | "none";
  }): { success: boolean; warning?: string };
  restartMPD(): { success: boolean; warning?: string };
  stopMPD(): { success: boolean; warning?: string };
  getMpdStatus(): { success: boolean; warning?: string };
  setOutputMode(mode: OutputMode): { success: boolean; warning?: string };
  getOutputMode(): OutputMode;
  getOutputDeviceName(): string | null;
}

export function AudioServiceImpl(): AudioService {
  const MPD_CONFIG_PATH =
    process.env.MPD_CONFIG_PATH ?? "/opt/sonect/data/mpd-audio.conf";

  function getAudioDevices(): AudioDevice[] {
    return detectAudioDevices();
  }

  function getCurrentAudioOutput(): {
    card: string;
    name: string;
  } | null {
    try {
      const config = fs.readFileSync(MPD_CONFIG_PATH, "utf-8");
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

  function configureAudioOutput(params: {
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

    const dir = path.dirname(MPD_CONFIG_PATH);

    if (!fs.existsSync(MPD_CONFIG_PATH)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(
          MPD_CONFIG_PATH,
          "# This file is managed by the Sonect frontend.\n# It is owned by the service user, so no sudo is needed for edits.\n\n" +
            newOutput +
            "\n",
          "utf-8",
        );
      } catch {
        return {
          success: false,
          warning: `Cannot write to ${MPD_CONFIG_PATH}. Check file permissions.`,
        };
      }

      const restartResult = restartMPD();
      return { success: true, warning: restartResult.warning };
    }

    let config: string;
    try {
      config = fs.readFileSync(MPD_CONFIG_PATH, "utf-8");
    } catch {
      return {
        success: false,
        warning: `Cannot read ${MPD_CONFIG_PATH}. File may not exist.`,
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
      fs.writeFileSync(MPD_CONFIG_PATH, config, "utf-8");
    } catch {
      return {
        success: false,
        warning: `Cannot write to ${MPD_CONFIG_PATH}. Check file permissions.`,
      };
    }

    const restartResult = restartMPD();
    return { success: true, warning: restartResult.warning };
  }

  function restartMPD(): { success: boolean; warning?: string } {
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

  function stopMPD(): { success: boolean; warning?: string } {
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

  function getMpdStatus(): {
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

  let _currentOutputMode: OutputMode = "mpd";
  let _lastAlsaConfig: string | null = null;
  let _lastDeviceName: string | null = null;

  function setOutputMode(mode: OutputMode): {
    success: boolean;
    warning?: string;
  } {
    if (mode === _currentOutputMode) {
      return { success: true };
    }

    const dir = path.dirname(MPD_CONFIG_PATH);

    if (mode === "browser") {
      const currentAlsa = getCurrentAudioOutput();
      if (currentAlsa) {
        _lastDeviceName = currentAlsa.name;
        _lastAlsaConfig = [
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
          MPD_CONFIG_PATH,
          "# This file is managed by the Sonect frontend.\n# Browser output mode — MPD plays silently.\n\n" +
            nullConfig +
            "\n",
          "utf-8",
        );
      } catch {
        return {
          success: false,
          warning: `Cannot write to ${MPD_CONFIG_PATH}.`,
        };
      }
    } else {
      _lastDeviceName = null;
      if (_lastAlsaConfig) {
        try {
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.writeFileSync(
            MPD_CONFIG_PATH,
            "# This file is managed by the Sonect frontend.\n\n" +
              _lastAlsaConfig +
              "\n",
            "utf-8",
          );
        } catch {
          return {
            success: false,
            warning: `Cannot write to ${MPD_CONFIG_PATH}.`,
          };
        }
      }
    }

    _currentOutputMode = mode;
    const restartResult = restartMPD();
    return { success: true, warning: restartResult.warning };
  }

  function getOutputMode(): OutputMode {
    return _currentOutputMode;
  }

  function getOutputDeviceName(): string | null {
    if (_currentOutputMode === "mpd") {
      const status = getCurrentAudioOutput();
      return status?.name ?? null;
    }
    return _lastDeviceName;
  }

  function checkTool(name: string): boolean {
    try {
      execSync(`which ${name}`, { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  return {
    getOutputMode,
    getOutputDeviceName,
    setOutputMode,
    getAudioDevices,
    getMpdStatus,
    stopMPD,
    restartMPD,
    setOutputMode,
    getOutputMode,
    getOutputDeviceName,
  };
}

export default AudioServiceImpl;
