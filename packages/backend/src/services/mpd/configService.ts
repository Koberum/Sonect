import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { checkTool } from "@services/utils/utils";

export interface ConfigService {
  getConfig(): { content: string; path: string };
  updateConfig(content: string): { success: boolean; warning?: string };
  ensureFollowOutsideSymlinks(): { success: boolean; warning?: string };
  getConfigPath(): string;
}

export class ConfigServiceImpl implements ConfigService {
  private readonly MPD_CONFIG_PATH =
    process.env.MPD_CONFIG_PATH ?? "/opt/sonect/data/mpd-audio.conf";

  private readonly FOLLOW_OUTSIDE_SYMLINKS = 'follow_outside_symlinks "yes"';

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
}
