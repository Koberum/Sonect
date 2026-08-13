import childProcess from "child_process";
import fs from "fs";
import path from "path";
import { storageDb } from "@repo/db";
import { mpdConnectionManager } from "./mpdConnectionManager";
import { encryptPassword, decryptPassword } from "./crypto";
import { scanLibrary } from "./libraryService";
import { computeSourceStats } from "./storageStats";
import { ensureFollowOutsideSymlinks } from "./configService";
import { markSetupCompleted } from "./setupService";
import { ValidationError } from "../middleware/errorHandler";

const MUSIC_DIR = process.env.MUSIC_DIR ?? "/opt/sonect/music";

// Object indirection so unit tests can stub these named exports (esmock
// cannot replace relative modules in this repo).
export const storageHooks = {
  ensureSymlinksAllowed: ensureFollowOutsideSymlinks,
  scanLibrary,
};

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
  mount_path?: string;
  username?: string;
  password?: string;
  enabled?: boolean;
}) {
  let segment = data.mount_path?.trim();

  // For local sources, mount_path is an internal symlink under MUSIC_DIR. When
  // omitted, generate a safe, unique folder name from the library name.
  if (data.type === "local" && !segment) {
    const base = slugifyName(data.name);
    segment = generateUniqueMountSegment(base);
  }

  if (!segment) {
    throw new ValidationError("Mount path must be provided", {
      mount_path: data.mount_path ?? "",
    });
  }

  const fullPath = buildMountPath(segment);

  // Validate and create the symlink BEFORE inserting the DB row, so a bad
  // local folder cannot leave a half-created source behind.
  if (data.type === "local") {
    ensureLocalSymlink({ uri: data.uri, mount_path: fullPath });
  }

  const id = storageDb.create({
    ...data,
    mount_path: fullPath,
    password: data.password ? encryptPassword(data.password) : data.password,
  });

  markSetupCompleted();

  if (data.type === "local") {
    storageHooks.ensureSymlinksAllowed();
    mpdConnectionManager.executeCommand("update").catch(() => {});
    storageHooks
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
  const existing = storageDb.getById(id);
  const nextType = data.type ?? existing?.type;
  const wasLocal = existing?.type === "local";
  const isLocal = nextType === "local";

  const updateData = { ...data } as typeof data & { mount_path?: string };

  // For local sources, mount_path is internal and should not be user-editable.
  // Keep the original mount_path stable so symlinks and network mounts do not
  // jump around when a user edits the name.
  if (!isLocal && data.mount_path) {
    updateData.mount_path = buildMountPath(data.mount_path);
  } else {
    delete updateData.mount_path;
  }
  if (data.password) {
    updateData.password = encryptPassword(data.password);
  }

  storageDb.update(id, updateData);

  if (existing && wasLocal && !isLocal) {
    removeLocalSymlink(existing.mount_path);
  }

  if (existing && isLocal) {
    const source = storageDb.getById(id);
    if (source) {
      if (wasLocal && source.mount_path !== existing.mount_path) {
        removeLocalSymlink(existing.mount_path);
      }
      ensureLocalSymlink(source);
      storageHooks.ensureSymlinksAllowed();
    }
  }

  return storageDb.getById(id);
}

export function deleteStorageSource(id: number) {
  const source = storageDb.getById(id);
  if (!source) return false;
  if (source.type === "local") {
    removeLocalSymlink(source.mount_path);
  }
  storageDb.delete(id);
  return true;
}

function slugifyName(name: string): string {
  let slug = name.toLowerCase();
  slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  slug = slug.replace(/[^a-z0-9]+/g, "-");
  slug = slug.replace(/^-+|-+$/g, "");
  if (!slug) slug = "local-source";
  return slug;
}

function generateUniqueMountSegment(baseSlug: string): string {
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

function buildMountPath(input: string): string {
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

function resolveLocalTarget(uri: string): string {
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

function ensureLocalSymlink(source: { uri: string; mount_path: string }): void {
  const target = resolveLocalTarget(source.uri);
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

  let stats: fs.Stats | null = null;
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

function removeLocalSymlink(mountPoint: string): void {
  try {
    const stats = fs.lstatSync(mountPoint);
    if (stats.isSymbolicLink()) fs.unlinkSync(mountPoint);
  } catch {
    // not present
  }
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

  const musicDir = path.resolve(process.env.MUSIC_DIR ?? "/opt/sonect/music");
  if (!source.mount_path.startsWith(musicDir)) {
    return { success: false, error: `Mount path must be under ${musicDir}` };
  }

  if (source.type === "local") {
    try {
      ensureLocalSymlink(source);
      storageHooks.ensureSymlinksAllowed();
      mpdConnectionManager.executeCommand("update").catch(() => {});
      storageHooks
        .scanLibrary()
        .catch((err) =>
          console.error(
            "[Storage] Library scan after local mount failed:",
            err,
          ),
        );
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
        await mountSmb(sourceDev, mountPoint, source.username, plainPassword);
        break;
      }
      case "nfs": {
        await mountNfs(sourceDev, mountPoint);
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

  if (source.type === "local") {
    removeLocalSymlink(source.mount_path);
    return { success: true };
  }

  const mountPath = source.mount_path;

  const mounts = listMounts();
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

export function listMounts(): MountInfo[] {
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

export async function mountAllEnabled(): Promise<void> {
  const sources = storageDb.getAll().filter((s) => s.enabled);
  let mounted = 0;
  for (const source of sources) {
    try {
      if (source.type === "local") {
        ensureLocalSymlink(source);
        storageHooks.ensureSymlinksAllowed();
      } else {
        const mountPoint = source.mount_path;
        fs.mkdirSync(mountPoint, { recursive: true });

        const sourceDev = source.uri;
        const plainPassword = source.password
          ? decryptPassword(source.password) || undefined
          : undefined;

        switch (source.type) {
          case "smb":
            await mountSmb(
              sourceDev,
              mountPoint,
              source.username,
              plainPassword,
            );
            break;
          case "nfs":
            await mountNfs(sourceDev, mountPoint);
            break;
        }
      }
      mounted++;
    } catch {
      console.error(`[Storage] Failed to mount ${source.name}: ${source.uri}`);
    }
  }
  if (mounted > 0) {
    storageHooks
      .scanLibrary()
      .catch((err) =>
        console.error(
          "[Storage] Library scan after startup mounts failed:",
          err,
        ),
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
      } catch {}
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

async function mountNfs(uri: string, mountPoint: string): Promise<void> {
  childProcess.execSync(
    `sudo mount -t nfs "${uri}" "${mountPoint}" -o "nolock,hard,intr"`,
    {
      stdio: "ignore",
      timeout: 30000,
    },
  );
}
