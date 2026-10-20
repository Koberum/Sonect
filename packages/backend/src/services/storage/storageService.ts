import fs from "fs";
import path from "path";
import { storageDb } from "@repo/db";
import {
  computeSourceStats,
  computeSourceStatsAsync,
  decodeEntryName,
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
 * returns `undefined` so the caller can skip stats. Only an unreadable root
 * throws; unreadable subdirectories and entries with non-UTF-8 names are
 * skipped so suggestions still get stats for the readable subset.
 */
export function computeSourceStatsWithinBudget(
  root: string,
  maxFiles: number,
): SourceStats | undefined {
  const exts = getAudioExtensions();
  let fileCount = 0;
  let dirCount = 0;
  let totalSize = 0;
  let exceeded = false;

  const visit = (dir: string, isRoot: boolean): void => {
    if (exceeded) return;
    let entries: fs.Dirent<Buffer>[];
    try {
      entries = fs.readdirSync(dir, {
        withFileTypes: true,
        encoding: "buffer",
      });
    } catch (err) {
      if (isRoot) {
        const code = (err as NodeJS.ErrnoException).code;
        throw new Error(
          `Cannot read directory: ${dir}${code === undefined ? "" : ` (${code})`}`,
          { cause: err },
        );
      }
      return;
    }
    for (const entry of entries) {
      if (exceeded) return;
      const name = decodeEntryName(entry.name);
      if (name === undefined) continue;
      const full = path.join(dir, name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        dirCount++;
        visit(full, false);
      } else if (entry.isFile()) {
        const ext = path.extname(name).slice(1).toLowerCase();
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

  visit(root, true);
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
  }): Promise<StorageSource | undefined>;
  updateStorageSource(
    id: number,
    data: { name?: string; path?: string; enabled?: boolean },
  ): StorageSource | undefined;
  deleteStorageSource(id: number): boolean;
  listMounts(): MountInfo[];
  getDetectedLibraries(): DetectedLibrary[];
  refreshStats(id: number): StorageSource | undefined;
  getStatsForPath(input: string): Promise<SourceStats>;
}

/**
 * Storage is provided by the host as bind mounts; Sonect never mounts anything
 * itself (no privileged operations). A "library source" is simply a folder that
 * already exists inside the container under MUSIC_DIR.
 */
export class StorageServiceImpl implements StorageService {
  /**
   * Stats computed on demand for (unregistered) detected folders via
   * `getStatsForPath`. Detected suggestions are not persisted anywhere, so this
   * in-memory cache keeps a user-requested compute visible across refetches
   * until the backend restarts. Bounded live walks always win over the cache.
   */
  private detectedStatsCache = new Map<string, SourceStats>();

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

  public async createStorageSource(data: {
    name: string;
    path: string;
    enabled?: boolean;
  }): Promise<StorageSource | undefined> {
    const fullPath = this.resolveLibraryPath(data.path);
    this.validateLibraryPath(fullPath);

    const id = storageDb.create({
      name: data.name,
      path: fullPath,
      enabled: data.enabled ?? true,
    });

    this.triggerScan();

    // Compute initial stats eagerly (async walk — a sync walk would freeze MPD
    // polling and HTTP on large folders) and persist them, so the new row shows
    // real values instead of 0/0/0 until the scanner finishes. The scanner walk
    // remains the long-term source of truth.
    try {
      const stats = await computeSourceStatsAsync(fullPath);
      storageDb.updateStats(id, stats);
    } catch (err) {
      console.error(
        "[Storage] Failed to scan stats for",
        data.name,
        ":",
        err instanceof Error ? err.message : err,
      );
    }

    return storageDb.getById(id) as StorageSource | undefined;
  }

  /**
   * Compute (and remember) stats for a first-level folder under MUSIC_DIR.
   * Used for detected suggestions whose stats the budget-aware walk omitted.
   */
  public async getStatsForPath(input: string): Promise<SourceStats> {
    const fullPath = this.resolveLibraryPath(input);
    if (path.dirname(fullPath) !== getMusicDir()) {
      throw new ValidationError(
        "Stats are only available for first-level folders under the music directory",
        { path: input },
      );
    }
    this.validateLibraryPath(fullPath);

    // Resolve symlinks and require the real folder to stay a direct child of
    // the real music directory: a first-level symlink must never let the walk
    // escape MUSIC_DIR.
    let realPath: string;
    let realMusicDir: string;
    try {
      realPath = fs.realpathSync(fullPath);
      realMusicDir = fs.realpathSync(getMusicDir());
    } catch {
      throw new ValidationError(`Cannot read library path: ${fullPath}`, {
        path: input,
      });
    }
    if (path.dirname(realPath) !== realMusicDir) {
      throw new ValidationError(
        "Stats are only available for first-level folders under the music directory",
        { path: input },
      );
    }

    let stats: SourceStats;
    try {
      stats = await computeSourceStatsAsync(fullPath);
    } catch {
      // Unreadable folder (unmounted share, permissions): same 400 contract as
      // refreshStats rather than an opaque 500.
      throw new ValidationError(`Cannot read library path: ${fullPath}`, {
        path: input,
      });
    }
    this.detectedStatsCache.set(fullPath, stats);
    return stats;
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
        const stats = this.computeBoundedStats(full);
        if (stats) {
          library.stats = stats;
        } else {
          // Budget exceeded: fall back to stats the user computed on demand.
          const cached = this.detectedStatsCache.get(full);
          if (cached) library.stats = cached;
        }
      } catch {
        // Unreadable directory → omit stats, still surface the suggestion.
      }
      libraries.push(library);
    }

    return libraries;
  }

  /**
   * Budget-aware sync walk for suggestions. Exposed as an instance method so
   * tests can simulate "stats omitted" without creating 20k+ files.
   */
  protected computeBoundedStats(root: string): SourceStats | undefined {
    return computeSourceStatsWithinBudget(root, MAX_SUGGESTION_STATS_FILES);
  }

  /**
   * Recompute on-disk stats for a registered source and persist them.
   */
  public refreshStats(id: number): StorageSource | undefined {
    const source = storageDb.getById(id);
    if (!source) return undefined;
    let stats: SourceStats;
    try {
      stats = computeSourceStats(source.path);
    } catch {
      // Foreseeable (unmounted share, permissions): surface a 400 rather than
      // an opaque 500 and leave the stored stats untouched.
      throw new ValidationError(`Cannot read library path: ${source.path}`, {
        path: source.path,
      });
    }
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
