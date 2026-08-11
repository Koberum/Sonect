import type { OutputMode } from "@repo/types";

const API_BASE = "/system";

export interface AudioDevice {
  card: string;
  name: string;
  description: string;
  usb: boolean;
  usbVendor?: string;
  usbProduct?: string;
}

export interface WifiNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
}

export interface StorageSource {
  id: number;
  name: string;
  type: "smb" | "nfs" | "local";
  uri: string; // address or path
  mount_path: string; // local mount path
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

export interface SystemStatus {
  tools: {
    aplay: boolean;
    lsusb: boolean;
    nmcli: boolean;
    systemctl: boolean;
    mpd: boolean;
  };
  audio: { available: boolean; cards: AudioDevice[] };
  network: { available: boolean; connected: boolean; ssid?: string };
  mpdConnected: boolean;
  setupCompleted: string[];
}

export async function getSystemStatus(): Promise<SystemStatus> {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) throw new Error("Failed to fetch system status");
  return res.json();
}

export async function getAudioDevices(): Promise<AudioDevice[]> {
  const res = await fetch(`${API_BASE}/audio/devices`);
  if (!res.ok) throw new Error("Failed to fetch audio devices");
  return res.json();
}

export async function configureAudio(params: {
  card: string;
  name: string;
  mixerType?: "hardware" | "software" | "none";
}): Promise<{ success: boolean; warning?: string }> {
  const res = await fetch(`${API_BASE}/audio/configure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to configure audio");
  return res.json();
}

export async function scanWifi(): Promise<WifiNetwork[]> {
  const res = await fetch(`${API_BASE}/network/wifi/scan`);
  if (!res.ok) throw new Error("Failed to scan WiFi");
  return res.json();
}

export async function connectWifi(
  ssid: string,
  password?: string,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/network/wifi/connect`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ssid, password }),
  });
  if (!res.ok) throw new Error("Failed to connect");
  return res.json();
}

export async function disconnectWifi(): Promise<{
  success: boolean;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/network/wifi/disconnect`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to disconnect");
  return res.json();
}

export async function getStorageSources(): Promise<StorageSource[]> {
  const res = await fetch(`${API_BASE}/storage/sources`);
  if (!res.ok) throw new Error("Failed to fetch storage sources");
  return res.json();
}

export async function createStorageSource(data: {
  name: string;
  type: "smb" | "nfs" | "local";
  uri: string;
  mount_path: string;
  username?: string;
  password?: string;
  enabled?: boolean;
}): Promise<StorageSource> {
  const res = await fetch(`${API_BASE}/storage/sources`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create storage source");
  return res.json();
}

export async function updateStorageSource(
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
  const res = await fetch(`${API_BASE}/storage/sources/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update storage source");
  return res.json();
}

export async function deleteStorageSource(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/storage/sources/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete storage source");
}

export async function mountStorageSource(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/storage/sources/${id}/mount`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to mount storage source");
  return res.json();
}

export async function unmountStorageSource(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  const res = await fetch(`${API_BASE}/storage/sources/${id}/unmount`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to unmount storage source");
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "Unmount failed");
  return data;
}

export async function getActiveMounts(): Promise<MountInfo[]> {
  const res = await fetch(`${API_BASE}/storage/mounts`);
  if (!res.ok) throw new Error("Failed to fetch mounts");
  return res.json();
}

export async function getSetupProgress(): Promise<{
  steps: SetupStep[];
  complete: boolean;
  nextStep: string | null;
}> {
  const res = await fetch(`${API_BASE}/setup/progress`);
  if (!res.ok) throw new Error("Failed to fetch setup progress");
  return res.json();
}

export async function updateSetupProgress(
  step: string,
  completed: boolean,
): Promise<void> {
  const res = await fetch(`${API_BASE}/setup/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step, completed }),
  });
  if (!res.ok) throw new Error("Failed to update setup progress");
}

export interface AudioStatusResponse {
  card: string;
  name: string;
}

export interface NetworkStatusResponse {
  connected: boolean;
  ssid?: string;
  interface?: string;
  ip?: string;
  netmask?: string;
  gateway?: string;
  dns?: string[];
}

export async function getAudioStatus(): Promise<AudioStatusResponse | null> {
  const res = await fetch(`${API_BASE}/audio/status`);
  if (!res.ok) throw new Error("Failed to fetch audio status");
  return res.json();
}

export async function getNetworkStatus(): Promise<NetworkStatusResponse> {
  const res = await fetch(`${API_BASE}/network/status`);
  if (!res.ok) throw new Error("Failed to fetch network status");
  return res.json();
}

export async function getMpdConfig(): Promise<{
  content: string;
  path: string;
}> {
  const res = await fetch("/mpd/config");
  if (!res.ok) throw new Error("Failed to fetch MPD config");
  return res.json();
}

export async function updateMpdConfig(
  content: string,
): Promise<{ success: boolean; warning?: string }> {
  const res = await fetch("/mpd/config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to update MPD config");
  return res.json();
}

export async function restartMpd(): Promise<{
  success: boolean;
  warning?: string;
}> {
  const res = await fetch(`${API_BASE}/mpd/restart`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to restart MPD");
  return res.json();
}

export async function stopMpd(): Promise<{
  success: boolean;
  warning?: string;
}> {
  const res = await fetch(`${API_BASE}/mpd/stop`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to stop MPD");
  return res.json();
}

export async function getMpdStatus(): Promise<{
  running: boolean;
  pid?: string;
  error?: string;
}> {
  const res = await fetch(`${API_BASE}/mpd/status`);
  if (!res.ok) throw new Error("Failed to get MPD status");
  return res.json();
}

export interface HardwareUsage {
  cpu: {
    usage: number;
    cores: number;
    loadAvg: number[];
  };
  ram: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  process: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
  };
  uptime: number;
}

export async function getHardwareUsage(): Promise<HardwareUsage> {
  const res = await fetch(`${API_BASE}/hardware/usage`);
  if (!res.ok) throw new Error("Failed to fetch hardware usage");
  return res.json();
}

export async function getOutputMode(): Promise<{
  mode: OutputMode;
  deviceName: string | null;
}> {
  const res = await fetch(`${API_BASE}/output-mode`);
  if (!res.ok) throw new Error("Failed to fetch output mode");
  return res.json();
}

export async function setOutputMode(
  mode: OutputMode,
): Promise<{ success: boolean; warning?: string }> {
  const res = await fetch(`${API_BASE}/output-mode`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error("Failed to set output mode");
  return res.json();
}
