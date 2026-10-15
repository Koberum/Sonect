import fs from "fs";
import path from "path";
import { storageDb } from "@repo/db";
import {
  computeSourceStats,
  getAudioExtensions,
  type SourceStats,
} from "./storageStats";
import { ValidationError } from "@middleware/errorHandler";
import { DetectedLibrary, StorageSource } from "@repo/types";
import { MpdConnectionManager } from "@services/mpd/mpdConnectionManager";
import type { CatalogSyncOrchestrator } from "@services/library/catalogSyncOrchestrator";

/**
 * Suggestions are best-effort: a huge library must never block the request, so
 * stats are computed with a file budget and omitted when the cap is exceeded.
 */
const MAX_SUGGESTION_STATS_FILES = 20000;

/**
 * Read MUSIC_DIR at call time (not module load) so tests and config reloads can
 * point the service at a different library root.
 */
function getMusicDir(): string {
  return path.resolve(process.env.MUSIC_DIR ?? "/opt/sonect/music");
}

/**
 * Budget-aware twin of `computeSourceStats`: walks the same tree but stops as
 * soon as more than `maxFiles` audio files are counted, in which case it
 * returns `undefined` so the caller can skip stats. Unreadable directories
 * throw (the caller decides whether to omit stats for that entry).
 */
function computeSourceStatsWithBudget(
  root: string,
  maxFiles: number,
): SourceStats | undefined {
  const exts = getAudioExtensions();
  let fileCount = 0;
  let dirCount = 0;
  let totalSize = 0;
  let exceeded = false;

  const visit = (dir: string): void => {
    if (exceeded) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      throw new Error(`Cannot read directory: ${dir}`);
    }
    for (const entry of entries) {
      if (exceeded) return;
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        dirCount++;
        visit(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1).toLowerCase();
        if (!exts.has(ext)) continue;
        fileCount++;
        if (fileCount > maxFiles) {
          exceeded = true;
          return;
        }
        try {
          totalSize += fs.statSync(full).size;
        } catch {
          // file vanished mid-walk
        }
      }
    }
  };

  visit(root);
  if (exceeded) return undefined;
  return { file_count: fileCount, dir_count: dirCount, total_size: totalSize };
}

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
  getDetectedLibraries(): DetectedLibrary[];
  refreshStats(id: number): StorageSource | undefined;
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
      const musicDir = getMusicDir();
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

  /**
   * First-level folders under MUSIC_DIR, annotated with whether the host mounted
   * them and whether they are already registered as a library source. Used by
   * the Add-Library form to suggest candidates (Plex/Immich style). Never throws
   * for a single unreadable entry; stats are best-effort and bounded.
   */
  public getDetectedLibraries(): DetectedLibrary[] {
    const musicDir = getMusicDir();
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(musicDir, { withFileTypes: true });
    } catch {
      return [];
    }

    const mounts = this.listMounts();
    const registeredPaths = new Set(storageDb.getAll().map((s) => s.path));
    const libraries: DetectedLibrary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(musicDir, entry.name);
      const library: DetectedLibrary = {
        path: full,
        name: entry.name,
        isMount: mounts.some((m) => m.path === full),
        registered: registeredPaths.has(full),
      };
      try {
        const stats = computeSourceStatsWithBudget(
          full,
          MAX_SUGGESTION_STATS_FILES,
        );
        if (stats) library.stats = stats;
      } catch {
        // Unreadable directory → omit stats, still surface the suggestion.
      }
      libraries.push(library);
    }

    return libraries;
  }

  /**
   * Recompute on-disk stats for a registered source and persist them.
   */
  public refreshStats(id: number): StorageSource | undefined {
    const source = storageDb.getById(id);
    if (!source) return undefined;
    const stats = computeSourceStats(source.path);
    storageDb.updateStats(id, stats);
    return storageDb.getById(id) as StorageSource | undefined;
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
    const musicDir = getMusicDir();
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
