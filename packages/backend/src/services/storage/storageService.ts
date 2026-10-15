import fs from "fs";
import path from "path";
import { storageDb } from "@repo/db";
import { computeSourceStats } from "./storageStats";
import { ValidationError } from "@middleware/errorHandler";
import { StorageSource } from "@repo/types";
import { MpdConnectionManager } from "@services/mpd/mpdConnectionManager";
import type { CatalogSyncOrchestrator } from "@services/library/catalogSyncOrchestrator";

const MUSIC_DIR = process.env.MUSIC_DIR ?? "/opt/sonect/music";

interface MountInfo {
  path: string;
  uri: string;
}

export interface StorageService {
  getStorageSourcesHandler(): Promise<StorageSource[]>;
  getStorageSource(id: number): StorageSource | undefined;
  createStorageSource(data: {
    name: string;
    path: string;
    enabled?: boolean;
  }): StorageSource | undefined;
  updateStorageSource(
    id: number,
    data: { name?: string; path?: string; enabled?: boolean },
  ): StorageSource | undefined;
  deleteStorageSource(id: number): boolean;
  listMounts(): MountInfo[];
}

/**
 * Storage is provided by the host as bind mounts; Sonect never mounts anything
 * itself (no privileged operations). A "library source" is simply a folder that
 * already exists inside the container under MUSIC_DIR.
 */
export class StorageServiceImpl implements StorageService {
  constructor(
    private mpdConnectionManager: MpdConnectionManager,
    private catalogSyncOrchestrator: CatalogSyncOrchestrator,
  ) {}

  public async getStorageSourcesHandler(): Promise<StorageSource[]> {
    return storageDb.getAll() as StorageSource[];
  }

  public getStorageSource(id: number): StorageSource | undefined {
    return storageDb.getById(id) as StorageSource | undefined;
  }

  public createStorageSource(data: {
    name: string;
    path: string;
    enabled?: boolean;
  }): StorageSource | undefined {
    const fullPath = this.resolveLibraryPath(data.path);
    this.validateLibraryPath(fullPath);

    const id = storageDb.create({
      name: data.name,
      path: fullPath,
      enabled: data.enabled ?? true,
    });

    this.triggerScan();

    let created = storageDb.getById(id);

    // Compute initial stats eagerly so the setup wizard can show immediate
    // feedback. These are not persisted here; the library scanner walk that
    // runs during sync remains the source of truth for long-term values.
    if (created) {
      try {
        const stats = computeSourceStats(fullPath);
        created = { ...created, ...stats };
      } catch (err) {
        console.error(
          "[Storage] Failed to scan stats for",
          data.name,
          ":",
          err instanceof Error ? err.message : err,
        );
      }
    }

    return created as StorageSource | undefined;
  }

  public updateStorageSource(
    id: number,
    data: { name?: string; path?: string; enabled?: boolean },
  ): StorageSource | undefined {
    const existing = storageDb.getById(id);
    if (!existing) return undefined;

    const updateData: { name?: string; path?: string; enabled?: boolean } = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    let pathChanged = false;
    if (data.path !== undefined) {
      const fullPath = this.resolveLibraryPath(data.path);
      this.validateLibraryPath(fullPath);
      if (fullPath !== existing.path) {
        updateData.path = fullPath;
        pathChanged = true;
      }
    }

    storageDb.update(id, updateData);

    if (pathChanged) {
      this.triggerScan();
    }

    return storageDb.getById(id) as StorageSource | undefined;
  }

  public deleteStorageSource(id: number): boolean {
    const source = storageDb.getById(id);
    if (!source) return false;
    storageDb.delete(id);
    this.triggerScan();
    return true;
  }

  /**
   * Read-only view of what the host has mounted under MUSIC_DIR. Used by the
   * Settings UI to show the libraries the user added via bind mounts.
   */
  public listMounts(): MountInfo[] {
    try {
      const musicDir = path.resolve(MUSIC_DIR);
      const raw = fs.readFileSync("/proc/mounts", "utf-8");
      const mounts: MountInfo[] = [];
      for (const line of raw.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;
        const [device, mnt] = parts;
        if (mnt.startsWith(musicDir + "/") || mnt === musicDir) {
          if (mnt !== musicDir) {
            mounts.push({ path: mnt, uri: device });
          }
        }
      }
      return mounts;
    } catch {
      return [];
    }
  }

  private triggerScan(): void {
    this.mpdConnectionManager.executeCommand("update").catch(() => {});
    this.catalogSyncOrchestrator
      .scanLibrary()
      .catch((err) => console.error("[Storage] Library scan failed:", err));
  }

  /**
   * Resolve a user-supplied library path to an absolute path under MUSIC_DIR.
   * Relative paths are resolved against MUSIC_DIR.
   */
  private resolveLibraryPath(input: string): string {
    const musicDir = path.resolve(MUSIC_DIR);
    const normalized = input.replace(/\\/g, "/");
    const full = path.isAbsolute(normalized)
      ? path.resolve(normalized)
      : path.resolve(path.join(musicDir, normalized));
    const prefix = musicDir.endsWith("/") ? musicDir : musicDir + "/";
    if (!full.startsWith(prefix)) {
      throw new ValidationError(
        "Library path must be a subfolder of the music directory",
        { path: input },
      );
    }
    return full;
  }

  private validateLibraryPath(fullPath: string): void {
    let stats: fs.Stats;
    try {
      stats = fs.statSync(fullPath);
    } catch {
      throw new ValidationError(`Library path does not exist: ${fullPath}`, {
        path: fullPath,
      });
    }
    if (!stats.isDirectory()) {
      throw new ValidationError(
        `Library path is not a directory: ${fullPath}`,
        { path: fullPath },
      );
    }
  }
}
