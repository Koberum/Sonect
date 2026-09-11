import childProcess from "child_process";
import fs from "fs";
import type { LogService } from "@services/utils/logService";
import path from "path";
import { storageDb } from "@repo/db";
import { encryptPassword, decryptPassword } from "../utils/crypto";
import { computeSourceStats } from "./storageStats";
import { ValidationError } from "@middleware/errorHandler";
import { StorageSource } from "@repo/types";
import { MpdConnectionManager } from "@services/mpd/mpdConnectionManager";
import type { LibraryService } from "@services/library/libraryService";
import type { ConfigService } from "@services/mpd/configService";

const MUSIC_DIR = process.env.MUSIC_DIR ?? "/opt/sonect/music";

interface MountInfo {
  path: string;
  uri: string;
}
export interface StorageService {
  getStorageSourcesHandler(): Promise<StorageSource[]>;
  getStorageSource(id: number): any;
  createStorageSource(data: {
    name: string;
    type: "smb" | "nfs" | "local";
    uri: string;
    mount_path?: string;
    username?: string;
    password?: string;
    enabled?: boolean;
  }): any;
  updateStorageSource(
    id: number,
    data: {
      name?: string;
      type?: "smb" | "nfs" | "local";
      uri?: string;
      mount_path?: string;
      username?: string;
      password?: string;
      enabled?: boolean;
    },
  ): any;
  deleteStorageSource(id: number): boolean;
  slugifyName(name: string): string;
  generateUniqueMountSegment(baseSlug: string): string;
  resolveLocalTarget(uri: string): string;
  ensureLocalSymlink(source: { uri: string; mount_path: string }): void;
  removeLocalSymlink(mountPoint: string): void;
  sanitizeSource(source: Record<string, unknown>): Record<string, unknown>;
  mountSource(id: number): Promise<{ success: boolean; error?: string }>;
  unmountSource(id: number): Promise<{ success: boolean; error?: string }>;
  listMounts(): MountInfo[];
  mountAllEnabled(): Promise<void>;
  mountSmb(
    uri: string,
    mountPoint: string,
    username?: string,
    password?: string,
  ): Promise<void>;
  mountNfs(uri: string, mountPoint: string): Promise<void>;
}

export class StorageServiceImpl implements StorageService {
  constructor(
    private mpdConnectionManager: MpdConnectionManager,
    private libraryService: LibraryService,
    private configService: ConfigService,
    private logService: LogService,
  ) {}

  public async getStorageSourcesHandler(): Promise<StorageSource[]> {
    return storageDb.getAll() as StorageSource[];
  }

  public getStorageSource(id: number) {
    return storageDb.getById(id);
  }

  public createStorageSource(data: {
    name: string;
    type: "smb" | "nfs" | "local";
    uri: string;
    mount_path?: string;
    username?: string;
    password?: string;
    enabled?: boolean;
  }) {
    let segment = data.mount_path?.trim();

    // mount_path is an internal detail (symlink target for local, mount point for
    // network sources) under MUSIC_DIR. When omitted, generate a safe, unique
    // folder name from the library name for every source type.
    if (!segment) {
      const base = this.slugifyName(data.name);
      segment = this.generateUniqueMountSegment(base);
    }

    const fullPath = this.buildMountPath(segment);

    // Validate and create the symlink BEFORE inserting the DB row, so a bad
    // local folder cannot leave a half-created source behind.
    if (data.type === "local") {
      this.ensureLocalSymlink({ uri: data.uri, mount_path: fullPath });
    }

    const id = storageDb.create({
      ...data,
      mount_path: fullPath,
      password: data.password ? encryptPassword(data.password) : data.password,
    });

    if (data.type === "local") {
      this.configService.ensureFollowOutsideSymlinks();
      this.mpdConnectionManager.executeCommand("update").catch(() => {});
      this.libraryService
        .scanLibrary()
        .catch((err) =>
          console.error(
            "[Storage] Library scan after local source create failed:",
            err,
          ),
        );
    }

    let created = storageDb.getById(id);

    // For local sources, compute initial stats eagerly so the setup wizard can
    // show immediate feedback. This does not persist stats; the periodic
    // scanStorageStats() job remains the source of truth for long-term values.
    if (data.type === "local" && created) {
      try {
        const stats = computeSourceStats(fullPath);
        created = { ...(created as any), ...stats };
      } catch (err: any) {
        console.error(
          "[Storage] Failed to scan stats for",
          data.name,
          ":",
          err?.message ?? err,
        );
      }
    }

    return created;
  }

  public updateStorageSource(
    id: number,
    data: {
      name?: string;
      type?: "smb" | "nfs" | "local";
      uri?: string;
      mount_path?: string;
      username?: string;
      password?: string;
      enabled?: boolean;
    },
  ) {
    const existing = storageDb.getById(id);
    const nextType = data.type ?? existing?.type;
    const wasLocal = existing?.type === "local";
    const isLocal = nextType === "local";

    const updateData = { ...data } as typeof data & { mount_path?: string };

    // For local sources, mount_path is internal and should not be user-editable.
    // Keep the original mount_path stable so symlinks and network mounts do not
    // jump around when a user edits the name.
    if (!isLocal && data.mount_path) {
      updateData.mount_path = this.buildMountPath(data.mount_path);
    } else {
      delete updateData.mount_path;
    }
    if (data.password) {
      updateData.password = encryptPassword(data.password);
    }

    storageDb.update(id, updateData);

    if (existing && wasLocal && !isLocal) {
      this.removeLocalSymlink(existing.mount_path);
    }

    if (existing && isLocal) {
      const source = storageDb.getById(id);
      if (source) {
        if (wasLocal && source.mount_path !== existing.mount_path) {
          this.removeLocalSymlink(existing.mount_path);
        }
        this.ensureLocalSymlink(source);
        this.configService.ensureFollowOutsideSymlinks();
      }
    }

    return storageDb.getById(id);
  }

  public deleteStorageSource(id: number) {
    const source = storageDb.getById(id);
    if (!source) return false;
    if (source.type === "local") {
      this.removeLocalSymlink(source.mount_path);
    }
    storageDb.delete(id);
    return true;
  }

  public slugifyName(name: string): string {
    let slug = name.toLowerCase();
    slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    slug = slug.replace(/[^a-z0-9]+/g, "-");
    slug = slug.replace(/^-+|-+$/g, "");
    if (!slug) slug = "local-source";
    return slug;
  }

  public generateUniqueMountSegment(baseSlug: string): string {
    const musicDir = path.resolve(process.env.MUSIC_DIR ?? "/opt/sonect/music");
    let slug = baseSlug;
    let counter = 1;

    while (
      storageDb
        .getAll()
        .some((s) => path.resolve(s.mount_path) === path.join(musicDir, slug))
    ) {
      counter += 1;
      slug = `${baseSlug}-${counter}`;
    }

    return slug;
  }

  private buildMountPath(input: string): string {
    const musicDir = path.resolve(process.env.MUSIC_DIR ?? "/opt/sonect/music");
    const normalized = input.replace(/\\/g, "/");
    let full: string;
    if (normalized.startsWith(musicDir)) {
      full = normalized;
    } else {
      full = path.join(musicDir, normalized);
    }
    const resolved = path.resolve(full);
    const musicDirPrefix = musicDir.endsWith("/") ? musicDir : musicDir + "/";
    if (resolved === musicDir || !resolved.startsWith(musicDirPrefix)) {
      throw new ValidationError(
        "Mount path must be a subfolder under the music directory",
        {
          mount_path: input,
        },
      );
    }
    return resolved;
  }

  public resolveLocalTarget(uri: string): string {
    const target = path.resolve(uri.replace(/\\/g, "/"));
    const musicDir = path.resolve(process.env.MUSIC_DIR ?? "/opt/sonect/music");
    if (target === musicDir || target.startsWith(musicDir + "/")) {
      throw new ValidationError(
        "Local folder must be outside the music directory",
        {
          uri,
        },
      );
    }
    return target;
  }

  public ensureLocalSymlink(source: { uri: string; mount_path: string }): void {
    const target = this.resolveLocalTarget(source.uri);
    if (!fs.existsSync(target)) {
      throw new ValidationError(`Local folder does not exist: ${target}`, {
        uri: source.uri,
      });
    }
    if (!fs.statSync(target).isDirectory()) {
      throw new ValidationError(`Local folder is not a directory: ${target}`, {
        uri: source.uri,
      });
    }

    const mountPoint = source.mount_path;
    fs.mkdirSync(path.dirname(mountPoint), { recursive: true });

    let stats: fs.Stats | null;
    try {
      stats = fs.lstatSync(mountPoint);
    } catch {
      stats = null;
    }
    if (stats) {
      if (stats.isSymbolicLink()) {
        if (path.resolve(fs.readlinkSync(mountPoint)) === target) return;
        fs.unlinkSync(mountPoint);
      } else if (stats.isDirectory()) {
        throw new ValidationError(`A folder already exists at ${mountPoint}`, {
          mount_path: mountPoint,
        });
      } else {
        throw new ValidationError(`A file already exists at ${mountPoint}`, {
          mount_path: mountPoint,
        });
      }
    }

    fs.symlinkSync(target, mountPoint);
  }

  public removeLocalSymlink(mountPoint: string): void {
    try {
      const stats = fs.lstatSync(mountPoint);
      if (stats.isSymbolicLink()) fs.unlinkSync(mountPoint);
    } catch {
      // not present
    }
  }

  public sanitizeSource(source: Record<string, unknown>) {
    if (source && source.password) {
      return { ...source, password: "••••••" };
    }
    return source;
  }

  public async mountSource(
    id: number,
  ): Promise<{ success: boolean; error?: string }> {
    const source = storageDb.getById(id);
    if (!source) return { success: false, error: "Source not found" };

    const musicDir = path.resolve(process.env.MUSIC_DIR ?? "/opt/sonect/music");
    if (!source.mount_path.startsWith(musicDir)) {
      return { success: false, error: `Mount path must be under ${musicDir}` };
    }

    if (source.type === "local") {
      try {
        this.ensureLocalSymlink(source);
        this.configService.ensureFollowOutsideSymlinks();
        await this.mpdConnectionManager.executeCommand("update");
        await this.libraryService.scanLibrary();
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    try {
      const mountPoint = source.mount_path;

      fs.mkdirSync(mountPoint, { recursive: true });

      const sourceDev = source.uri;
      const plainPassword = source.password
        ? decryptPassword(source.password) || undefined
        : undefined;

      switch (source.type) {
        case "smb": {
          await this.mountSmb(
            sourceDev,
            mountPoint,
            source.username,
            plainPassword,
          );
          break;
        }
        case "nfs": {
          await this.mountNfs(sourceDev, mountPoint);
          break;
        }
      }

      await this.mpdConnectionManager.executeCommand("update");
      await this.libraryService.scanLibrary();

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async unmountSource(
    id: number,
  ): Promise<{ success: boolean; error?: string }> {
    const source = storageDb.getById(id);
    if (!source) return { success: false, error: "Source not found" };

    if (source.type === "local") {
      this.removeLocalSymlink(source.mount_path);
      return { success: true };
    }

    const mountPath = source.mount_path;

    const mounts = this.listMounts();
    const isMounted = mounts.some((m) => m.path === mountPath);
    if (!isMounted) return { success: true };

    try {
      childProcess.execSync(`sudo umount "${mountPath}"`, {
        stdio: "pipe",
        timeout: 15000,
      });
      return { success: true };
    } catch (err: any) {
      const stderr = err.stderr?.toString() || "";
      if (stderr.includes("busy") || stderr.includes("target is busy")) {
        try {
          childProcess.execSync(`sudo umount -l "${mountPath}"`, {
            stdio: "pipe",
            timeout: 15000,
          });
          return { success: true };
        } catch (lazyErr: any) {
          const lazyStderr = lazyErr.stderr?.toString() || "";
          return {
            success: false,
            error: `Lazy unmount failed: ${lazyStderr || lazyErr.message}`,
          };
        }
      }
      return { success: false, error: stderr || err.message };
    }
  }

  public listMounts(): MountInfo[] {
    try {
      const musicDir = path.resolve(MUSIC_DIR);
      const raw = childProcess.execSync("cat /proc/mounts", {
        encoding: "utf-8",
        timeout: 5000,
      });
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

  public async mountAllEnabled(): Promise<void> {
    const sources = storageDb.getAll().filter((s) => s.enabled);
    let mounted = 0;
    for (const source of sources) {
      try {
        if (source.type === "local") {
          this.ensureLocalSymlink(source);
          this.configService.ensureFollowOutsideSymlinks();
        } else {
          const mountPoint = source.mount_path;
          fs.mkdirSync(mountPoint, { recursive: true });

          const sourceDev = source.uri;
          const plainPassword = source.password
            ? decryptPassword(source.password) || undefined
            : undefined;

          switch (source.type) {
            case "smb":
              await this.mountSmb(
                sourceDev,
                mountPoint,
                source.username,
                plainPassword,
              );
              break;
            case "nfs":
              await this.mountNfs(sourceDev, mountPoint);
              break;
          }
        }
        mounted++;
      } catch {
        console.error(
          `[Storage] Failed to mount ${source.name}: ${source.uri}`,
        );
      }
    }
    if (mounted > 0) {
      this.libraryService
        .scanLibrary()
        .catch((err) =>
          console.error(
            "[Storage] Library scan after startup mounts failed:",
            err,
          ),
        );
    }
  }

  public async mountSmb(
    uri: string,
    mountPoint: string,
    username?: string,
    password?: string,
  ): Promise<void> {
    let opts = "noperm,iocharset=utf8,file_mode=0644,dir_mode=0755";

    if (username || password) {
      const credsPath = path.join("/tmp", `sonect-smb-creds-${Date.now()}`);
      const creds: string[] = [];
      if (username) creds.push(`username=${username}`);
      if (password) creds.push(`password=${password}`);
      fs.writeFileSync(credsPath, creds.join("\n") + "\n", { mode: 0o600 });
      opts += `,credentials="${credsPath}"`;
      try {
        childProcess.execSync(
          `sudo mount -t cifs "${uri}" "${mountPoint}" -o "${opts}"`,
          {
            stdio: "ignore",
            timeout: 30000,
          },
        );
      } finally {
        try {
          fs.unlinkSync(credsPath);
        } catch {
          this.logService.pushLog(
            "warn",
            `[Storage] Failed to delete SMB credentials file: ${credsPath}`,
          );
        }
      }
    } else {
      childProcess.execSync(
        `sudo mount -t cifs "${uri}" "${mountPoint}" -o "${opts}"`,
        {
          stdio: "ignore",
          timeout: 30000,
        },
      );
    }
  }

  public async mountNfs(uri: string, mountPoint: string): Promise<void> {
    childProcess.execSync(
      `sudo mount -t nfs "${uri}" "${mountPoint}" -o "nolock,hard,intr"`,
      {
        stdio: "ignore",
        timeout: 30000,
      },
    );
  }
}
