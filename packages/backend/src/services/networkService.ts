import { execSync, exec } from "child_process";
import os from "os";
import fs from "fs";

export interface WifiNetwork {
  ssid: string;
  signal: number;
  secured: boolean;
}

export interface NetworkStatus {
  connected: boolean;
  ssid?: string;
  interface?: string;
  ip?: string;
  netmask?: string;
  gateway?: string;
  dns?: string[];
}

const NMCLI_AVAILABLE = checkTool("nmcli");

function checkTool(name: string): boolean {
  try {
    execSync(`which ${name}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function isNmcliAvailable(): boolean {
  return NMCLI_AVAILABLE;
}

export function scanWifi(): WifiNetwork[] {
  if (!NMCLI_AVAILABLE)
    throw new Error("nmcli is not available on this system");

  try {
    const output = execSync(
      "nmcli -t -f SSID,SIGNAL,SECURITY device wifi list 2>/dev/null",
      {
        encoding: "utf-8",
        timeout: 15000,
      },
    );

    return output
      .trim()
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const [ssid, signal, security] = line.split(":");
        return {
          ssid: ssid || "",
          signal: parseInt(signal || "0", 10),
          secured: (security || "") !== "" && security !== "--",
        };
      })
      .filter((n) => n.ssid);
  } catch {
    throw new Error("Failed to scan WiFi networks");
  }
}

export async function connectWifi(
  ssid: string,
  password?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!NMCLI_AVAILABLE)
    return { success: false, error: "nmcli is not available" };

  return new Promise((resolve) => {
    const args = password
      ? ["device", "wifi", "connect", ssid, "password", password]
      : ["device", "wifi", "connect", ssid];

    exec(
      `nmcli ${args.map((a) => `"${a}"`).join(" ")}`,
      { timeout: 30000 },
      (error) => {
        if (error) {
          resolve({
            success: false,
            error: `Connection failed: ${error.message}`,
          });
        } else {
          resolve({ success: true });
        }
      },
    );
  });
}

export async function disconnectWifi(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!NMCLI_AVAILABLE)
    return { success: false, error: "nmcli is not available" };

  try {
    const active = execSync(
      "nmcli -t -f TYPE,DEVICE connection show --active 2>/dev/null",
      {
        encoding: "utf-8",
        timeout: 5000,
      },
    );

    const wifiLine = active.split("\n").find((l) => l.startsWith("wifi:"));

    if (!wifiLine)
      return { success: false, error: "No active WiFi connection" };

    const device = wifiLine.split(":")[1];
    execSync(`nmcli device disconnect ${device}`, {
      stdio: "ignore",
      timeout: 10000,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function getNetworkStatus(): NetworkStatus {
  if (!NMCLI_AVAILABLE) return { connected: false };

  try {
    const output = execSync(
      "nmcli -t -f NAME,TYPE,STATE,DEVICE connection show --active 2>/dev/null",
      {
        encoding: "utf-8",
        timeout: 5000,
      },
    );

    const lines = output.trim().split("\n");
    const wifiLine = lines.find(
      (l) => l.includes("wifi") && l.includes("activated"),
    );

    if (wifiLine) {
      const [ssid, , , iface] = wifiLine.split(":");
      const addr = resolveAddr(iface);
      return {
        connected: true,
        ssid,
        interface: iface,
        ip: addr?.address,
        netmask: addr?.netmask,
        gateway: resolveGateway(iface),
        dns: resolveDns(iface),
      };
    }

    const anyLine = lines.find((l) => l.includes("activated"));
    if (anyLine) {
      const [name, , , iface] = anyLine.split(":");
      const addr = resolveAddr(iface);
      return {
        connected: true,
        ssid: name,
        interface: iface,
        ip: addr?.address,
        netmask: addr?.netmask,
        gateway: resolveGateway(iface),
        dns: resolveDns(iface),
      };
    }

    return { connected: false };
  } catch {
    return { connected: false };
  }
}

function resolveAddr(
  iface: string,
): { address: string; netmask: string } | undefined {
  const interfaces = os.networkInterfaces();
  const info = interfaces[iface];
  if (!info) return undefined;
  const ipv4 = info.find((addr) => addr.family === "IPv4" && !addr.internal);
  if (!ipv4) return undefined;
  return { address: ipv4.address, netmask: ipv4.netmask };
}

function resolveGateway(iface: string): string | undefined {
  try {
    const output = execSync(
      `nmcli -t -f IP4.GATEWAY device show "${iface}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 5000 },
    ).trim();
    const gateway = output.split(":")[1];
    return gateway || undefined;
  } catch {
    try {
      const output = execSync("ip route show default 2>/dev/null", {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      const match = output.match(/via\s+(\S+)/);
      return match?.[1];
    } catch {
      return undefined;
    }
  }
}

function resolveDns(iface: string): string[] {
  const servers: string[] = [];
  try {
    const output = execSync(
      `nmcli -t -f IP4.DNS device show "${iface}" 2>/dev/null`,
      { encoding: "utf-8", timeout: 5000 },
    );
    for (const line of output.trim().split("\n")) {
      const parts = line.split(":");
      if (parts.length >= 2 && parts[1]) servers.push(parts[1]);
    }
  } catch {
    // fall through to resolv.conf
  }
  if (servers.length === 0) {
    try {
      const content = fs.readFileSync("/etc/resolv.conf", "utf-8");
      for (const line of content.split("\n")) {
        const match = line.match(/^nameserver\s+(\S+)/);
        if (match) servers.push(match[1]);
      }
    } catch {
      // no dns info available
    }
  }
  return servers;
}
