import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { storageDb } from "@repo/db";
import { mpdConnectionManager } from "./mpdConnectionManager";
import { encryptPassword, decryptPassword } from "./crypto";
import { scanLibrary } from "./libraryService";

const MUSIC_DIR = process.env.MUSIC_DIR ?? "/opt/sonect/music";

export interface MountInfo {
  path: string;
  uri: string;
}

export function getStorageSources() {
  return storageDb.getAll();
}

export function getStorageSource(id: number) {
  return storageDb.getById(id);
}

export function createStorageSource(data: {
  name: string;
  type: "smb" | "nfs" | "local";
  uri: string;
  mount_path: string;
  username?: string;
  password?: string;
  enabled?: boolean;
}) {
  const fullPath = buildMountPath(data.mount_path);
  const id = storageDb.create({
    ...data,
    mount_path: fullPath,
    password: data.password ? encryptPassword(data.password) : data.password,
  });
  return storageDb.getById(id);
}

export function updateStorageSource(
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
  const updateData = { ...data };
  if (data.mount_path) {
    updateData.mount_path = buildMountPath(data.mount_path);
  }
  if (data.password) {
    updateData.password = encryptPassword(data.password);
  }
  storageDb.update(id, updateData);
  return storageDb.getById(id);
}

export function deleteStorageSource(id: number) {
  const source = storageDb.getById(id);
  if (!source) return false;
  storageDb.delete(id);
  return true;
}

function buildMountPath(input: string): string {
  const musicDir = path.resolve(MUSIC_DIR);
  const normalized = input.replace(/\\/g, "/");
  if (normalized.startsWith(musicDir)) return normalized;
  return path.join(musicDir, normalized);
}

export function sanitizeSource(source: Record<string, unknown>) {
  if (source && source.password) {
    return { ...source, password: "••••••" };
  }
  return source;
}

export async function mountSource(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  const source = storageDb.getById(id);
  if (!source) return { success: false, error: "Source not found" };

  try {
    const mountPoint = source.mount_path;

    const musicDir = path.resolve(MUSIC_DIR);
    if (!mountPoint.startsWith(musicDir)) {
      return { success: false, error: `Mount path must be under ${musicDir}` };
    }

    fs.mkdirSync(mountPoint, { recursive: true });

    const sourceDev = source.uri;
    const plainPassword = source.password
      ? decryptPassword(source.password) || undefined
      : undefined;

    switch (source.type) {
      case "smb": {
        await mountSmb(sourceDev, mountPoint, source.username, plainPassword);
        break;
      }
      case "nfs": {
        await mountNfs(sourceDev, mountPoint);
        break;
      }
      case "local": {
        await mountBind(sourceDev, mountPoint);
        break;
      }
    }

    mpdConnectionManager.executeCommand("update").catch(() => {});
    scanLibrary().catch((err) =>
      console.error("[Storage] Library scan after mount failed:", err),
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function unmountSource(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  const source = storageDb.getById(id);
  if (!source) return { success: false, error: "Source not found" };

  const mountPath = source.mount_path;

  const mounts = listMounts();
  const isMounted = mounts.some((m) => m.path === mountPath);
  if (!isMounted) return { success: true };

  try {
    execSync(`sudo umount "${mountPath}"`, {
      stdio: "pipe",
      timeout: 15000,
    });
    return { success: true };
  } catch (err: any) {
    const stderr = err.stderr?.toString() || "";
    if (stderr.includes("busy") || stderr.includes("target is busy")) {
      try {
        execSync(`sudo umount -l "${mountPath}"`, {
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

export function listMounts(): MountInfo[] {
  try {
    const musicDir = path.resolve(MUSIC_DIR);
    const raw = execSync("cat /proc/mounts", {
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

export async function mountAllEnabled(): Promise<void> {
  const sources = storageDb.getAll().filter((s) => s.enabled);
  let mounted = 0;
  for (const source of sources) {
    try {
      const mountPoint = source.mount_path;
      fs.mkdirSync(mountPoint, { recursive: true });

      const sourceDev = source.uri;
      const plainPassword = source.password
        ? decryptPassword(source.password) || undefined
        : undefined;

      switch (source.type) {
        case "smb":
          await mountSmb(sourceDev, mountPoint, source.username, plainPassword);
          break;
        case "nfs":
          await mountNfs(sourceDev, mountPoint);
          break;
        case "local":
          await mountBind(sourceDev, mountPoint);
          break;
      }
      mounted++;
    } catch {
      console.error(`[Storage] Failed to mount ${source.name}: ${source.uri}`);
    }
  }
  if (mounted > 0) {
    scanLibrary().catch((err) =>
      console.error("[Storage] Library scan after startup mounts failed:", err),
    );
  }
}

async function mountSmb(
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
      execSync(`sudo mount -t cifs "${uri}" "${mountPoint}" -o "${opts}"`, {
        stdio: "ignore",
        timeout: 30000,
      });
    } finally {
      try {
        fs.unlinkSync(credsPath);
      } catch {}
    }
  } else {
    execSync(`sudo mount -t cifs "${uri}" "${mountPoint}" -o "${opts}"`, {
      stdio: "ignore",
      timeout: 30000,
    });
  }
}

async function mountNfs(uri: string, mountPoint: string): Promise<void> {
  execSync(`sudo mount -t nfs "${uri}" "${mountPoint}" -o "nolock,hard,intr"`, {
    stdio: "ignore",
    timeout: 30000,
  });
}

async function mountBind(source: string, mountPoint: string): Promise<void> {
  execSync(`sudo mount --bind "${source}" "${mountPoint}"`, {
    stdio: "ignore",
    timeout: 15000,
  });
}
