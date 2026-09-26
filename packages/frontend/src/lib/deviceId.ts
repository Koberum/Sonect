const KEY = "sonect.deviceId";
const NAME_KEY = "sonect.deviceName";

function detectBrowser(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return "Opera";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  if (/Firefox\//.test(ua)) return "Firefox";
  return "Browser";
}

function detectOS(ua: string): string {
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Unknown";
}

function generateDeviceName(): string {
  if (typeof window === "undefined") return "Browser";
  const ua = navigator.userAgent ?? "";
  const browser = detectBrowser(ua);
  const os = detectOS(ua);
  return `${browser} on ${os}`;
}

export function getDeviceName(): string {
  if (typeof window === "undefined") return "";
  const stored = localStorage.getItem(NAME_KEY);
  if (stored && stored.trim().length > 0) return stored.trim();
  const generated = generateDeviceName();
  try {
    localStorage.setItem(NAME_KEY, generated);
  } catch {
    // ignore
  }
  return generated;
}

export function setDeviceName(name: string): void {
  if (typeof window === "undefined") return;
  const trimmed = name.trim();
  if (trimmed.length === 0) return;
  localStorage.setItem(NAME_KEY, trimmed);
}

export function getDeviceType(): "mobile" | "desktop" {
  if (typeof window === "undefined") return "desktop";
  const ua = navigator.userAgent ?? "";
  if (/Mobi|Android|iPhone|iPad|iPod/.test(ua)) return "mobile";
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  ) {
    // fallback coarse pointer as mobile hint when UA is ambiguous
    return "mobile";
  }
  return "desktop";
}

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (id && id.trim().length > 0) return id;
  id =
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
  localStorage.setItem(KEY, id);
  return id;
}

export function deviceHeaders(): Record<string, string> {
  const id = getDeviceId();
  const headers: Record<string, string> = {};
  if (id) headers["X-Device-Id"] = id;
  try {
    const name = getDeviceName();
    if (name) headers["X-Device-Name"] = name;
    const type = getDeviceType();
    if (type) headers["X-Device-Type"] = type;
  } catch {
    // ignore
  }
  return headers;
}
