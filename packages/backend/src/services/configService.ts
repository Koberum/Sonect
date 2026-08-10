import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const MPD_CONFIG_PATH =
  process.env.MPD_CONFIG_PATH ?? "/opt/sonect/data/mpd-audio.conf";

export function getConfig(): { content: string; path: string } {
  if (!fs.existsSync(MPD_CONFIG_PATH)) {
    try {
      fs.mkdirSync(path.dirname(MPD_CONFIG_PATH), { recursive: true });
      fs.writeFileSync(
        MPD_CONFIG_PATH,
        "# This file is managed by the Sonect frontend.\n# It is owned by the service user, so no sudo is needed for edits.\n",
        "utf-8",
      );
    } catch {
      return { content: "", path: MPD_CONFIG_PATH };
    }
  }
  try {
    const content = fs.readFileSync(MPD_CONFIG_PATH, "utf-8");
    return { content, path: MPD_CONFIG_PATH };
  } catch {
    return { content: "", path: MPD_CONFIG_PATH };
  }
}

export function updateConfig(content: string): {
  success: boolean;
  warning?: string;
} {
  try {
    fs.mkdirSync(path.dirname(MPD_CONFIG_PATH), { recursive: true });
    fs.writeFileSync(MPD_CONFIG_PATH, content, "utf-8");
  } catch {
    return {
      success: false,
      warning: `Cannot write to ${MPD_CONFIG_PATH}. Check file permissions.`,
    };
  }

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

export function getConfigPath(): string {
  return MPD_CONFIG_PATH;
}

function checkTool(name: string): boolean {
  try {
    execSync(`which ${name}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
