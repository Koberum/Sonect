import { apiFetch } from "@/lib/api";
import type { NetworkStatus, OutputMode } from "@repo/types";
import type { DashboardData } from "@repo/types/catalog";

export interface AudioDevice {
  card: string;
  name: string;
  description: string;
  usb: boolean;
  usbVendor?: string;
  usbProduct?: string;
}

export interface StorageSource {
  id: number;
  name: string;
  type: "smb" | "nfs" | "local";
  uri: string;
  mount_path: string;
  username?: string;
  password?: string;
  enabled: number;
  file_count?: number;
  dir_count?: number;
  total_size?: number;
  created_at?: string;
  updated_at?: string;
}

export interface MountInfo {
  path: string;
  uri: string;
}

export interface SetupStep {
  step: string;
  completed: boolean;
}

export function getAudioDevices(signal?: AbortSignal): Promise<AudioDevice[]> {
  return apiFetch("/system/audio/devices", { signal });
}

export function configureAudio(params: {
  card: string;
  name: string;
  mixerType?: "hardware" | "software" | "none";
}): Promise<{ success: boolean; warning?: string }> {
  return apiFetch("/system/audio/configure", {
    method: "POST",
    body: params,
  });
}

export function getStorageSources(
  signal?: AbortSignal,
): Promise<StorageSource[]> {
  return apiFetch("/system/storage/sources", { signal });
}

export function createStorageSource(data: {
  name: string;
  type: "smb" | "nfs" | "local";
  uri: string;
  mount_path?: string;
  username?: string;
  password?: string;
  enabled?: boolean;
}): Promise<StorageSource> {
  return apiFetch("/system/storage/sources", { method: "POST", body: data });
}

export function updateStorageSource(
  id: number,
  data: Partial<{
    name: string;
    type: "smb" | "nfs" | "local";
    uri: string;
    mount_path: string;
    username: string;
    password: string;
    enabled: boolean;
  }>,
): Promise<StorageSource> {
  return apiFetch(`/system/storage/sources/${id}`, {
    method: "PATCH",
    body: data,
  });
}

export function deleteStorageSource(id: number): Promise<void> {
  return apiFetch(`/system/storage/sources/${id}`, { method: "DELETE" });
}

export function mountStorageSource(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch(`/system/storage/sources/${id}/mount`, { method: "POST" });
}

export function unmountStorageSource(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch(`/system/storage/sources/${id}/unmount`, { method: "POST" });
}

export function getActiveMounts(signal?: AbortSignal): Promise<MountInfo[]> {
  return apiFetch("/system/storage/mounts", { signal });
}

export function getSetupProgress(signal?: AbortSignal): Promise<{
  steps: SetupStep[];
  complete: boolean;
  nextStep: string | null;
}> {
  return apiFetch("/system/setup/progress", { signal });
}

const SETUP_COMPLETE_CACHE_KEY = "setup-complete";

export async function isSetupCompleteForSession(): Promise<boolean> {
  const cached = sessionStorage.getItem(SETUP_COMPLETE_CACHE_KEY);
  if (cached !== null) return cached === "true";
  const progress = await getSetupProgress();
  sessionStorage.setItem(SETUP_COMPLETE_CACHE_KEY, String(progress.complete));
  return progress.complete;
}

export function updateSetupProgress(
  step: string,
  completed: boolean,
): Promise<void> {
  return apiFetch("/system/setup/progress", {
    method: "POST",
    body: { step, completed },
  });
}

export function completeSetup(): Promise<void> {
  return apiFetch("/system/setup/complete", { method: "POST" }).then(() => {
    sessionStorage.setItem(SETUP_COMPLETE_CACHE_KEY, "true");
  });
}

export function resetSetup(): Promise<{ success: boolean }> {
  return apiFetch("/system/setup/reset", { method: "POST" }).then((result) => {
    sessionStorage.removeItem(SETUP_COMPLETE_CACHE_KEY);
    return result as { success: boolean };
  });
}

export interface AudioStatusResponse {
  card: string;
  name: string;
}

export function getAudioStatus(
  signal?: AbortSignal,
): Promise<AudioStatusResponse | null> {
  return apiFetch("/system/audio/status", { signal });
}

export function getNetworkStatus(signal?: AbortSignal): Promise<NetworkStatus> {
  return apiFetch("/system/network/status", { signal });
}

export function restartMpd(): Promise<{ success: boolean; warning?: string }> {
  return apiFetch("/system/mpd/restart", { method: "POST" });
}

export function stopMpd(): Promise<{ success: boolean; warning?: string }> {
  return apiFetch("/system/mpd/stop", { method: "POST" });
}

export function getMpdStatus(signal?: AbortSignal): Promise<{
  running: boolean;
  pid?: string;
  error?: string;
}> {
  return apiFetch("/system/mpd/status", { signal });
}

export interface HardwareUsage {
  cpu: { usage: number; cores: number; loadAvg: number[] };
  ram: { total: number; used: number; free: number; usagePercent: number };
  process: { rss: number; heapTotal: number; heapUsed: number };
  uptime: number;
}

export function getHardwareUsage(signal?: AbortSignal): Promise<HardwareUsage> {
  return apiFetch("/system/hardware/usage", { signal });
}

export function getOutputMode(signal?: AbortSignal): Promise<{
  mode: OutputMode;
  deviceName: string | null;
}> {
  return apiFetch("/system/output-mode", { signal });
}

export function setOutputMode(
  mode: OutputMode,
): Promise<{ success: boolean; warning?: string }> {
  return apiFetch("/system/output-mode", {
    method: "PUT",
    body: { mode },
  });
}

export function getDashboard(signal?: AbortSignal): Promise<DashboardData> {
  return apiFetch("/dashboard", { signal });
}
