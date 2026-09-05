import { execSync } from "child_process";
import os from "os";
import { readAppVersion } from "./appVersion.js";
import { mpdConnectionManager } from "./mpdConnectionManager.js";

export interface SystemStatus {
  tools: {
    aplay: boolean;
    lsusb: boolean;
    systemctl: boolean;
    mpd: boolean;
  };
  audio: {
    available: boolean;
    cards: AudioDevice[];
  };
  mpdConnected: boolean;
  setupCompleted: string[];
  version: string;
}

export interface AudioDevice {
  card: string;
  name: string;
  description: string;
  usb: boolean;
  usbVendor?: string;
  usbProduct?: string;
}

export interface CpuTimes {
  user: number;
  nice: number;
  sys: number;
  idle: number;
  irq: number;
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

let prevCpuTimes: CpuTimes | null = null;

export function getHardwareUsage(): HardwareUsage {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const processMem = process.memoryUsage();

  let user = 0;
  let nice = 0;
  let sys = 0;
  let idle = 0;
  let irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }

  const curr: CpuTimes = { user, nice, sys, idle, irq };
  let usage = 0;

  if (prevCpuTimes) {
    const userDelta = curr.user - prevCpuTimes.user;
    const niceDelta = curr.nice - prevCpuTimes.nice;
    const sysDelta = curr.sys - prevCpuTimes.sys;
    const idleDelta = curr.idle - prevCpuTimes.idle;
    const irqDelta = curr.irq - prevCpuTimes.irq;
    const totalDelta = userDelta + niceDelta + sysDelta + idleDelta + irqDelta;
    if (totalDelta > 0) {
      usage = Math.round((100 * (totalDelta - idleDelta)) / totalDelta);
    }
  }
  prevCpuTimes = curr;

  return {
    cpu: {
      usage,
      cores: cpus.length,
      loadAvg: os.loadavg(),
    },
    ram: {
      total: totalMem,
      used: usedMem,
      free: freeMem,
      usagePercent: Math.round((usedMem / totalMem) * 100),
    },
    process: {
      rss: processMem.rss,
      heapTotal: processMem.heapTotal,
      heapUsed: processMem.heapUsed,
    },
    uptime: os.uptime(),
  };
}

export function getSystemStatus(): SystemStatus {
  const tools = {
    aplay: checkTool("aplay"),
    lsusb: checkTool("lsusb"),
    systemctl: checkTool("systemctl"),
    mpd: checkTool("mpd"),
  };

  const cards = tools.aplay ? detectAudioDevices() : [];

  return {
    tools,
    audio: {
      available: cards.length > 0,
      cards,
    },
    mpdConnected: mpdConnectionManager.connected,
    setupCompleted: [],
    version: readAppVersion(),
  };
}

function checkTool(name: string): boolean {
  try {
    execSync(`which ${name}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const USB_VENDOR_MAP: Record<string, string> = {
  "0bda": "Realtek Semiconductor Corp.",
  "08bb": "Texas Instruments",
  "041e": "Creative Technology",
  "0d8c": "C-Media Electronics",
  "1b3f": "Generalplus Technology",
  "20b1": "XMOS",
  "16d0": "MCS Electronics",
  "10c4": "Silicon Labs",
  "0483": "STMicroelectronics",
  "0424": "Microchip Technology",
};

export function detectAudioDevices(): AudioDevice[] {
  const devices: AudioDevice[] = [];

  try {
    const output = execSync("aplay -l 2>/dev/null", {
      encoding: "utf-8",
      timeout: 5000,
    });

    /* List of PLAYBACK Hardware Devices ****
        card 0: PCH [HDA Intel PCH], device 0: ALC671 Analog [ALC671 Analog]
          Subdevices: 1/1
          Subdevice #0: subdevice #0
        card 1: HDMI [HDA Intel HDMI], device 3: HDMI 0 [HDMI 0]
          Subdevices: 1/1
          Subdevice #0: subdevice #0
        card 1: HDMI [HDA Intel HDMI], device 7: HDMI 1 [HDMI 1]
          Subdevices: 1/1
          Subdevice #0: subdevice #0
        card 1: HDMI [HDA Intel HDMI], device 8: HDMI 2 [HDMI 2]
          Subdevices: 1/1
          Subdevice #0: subdevice #0
    */

    const deviceRegex =
      /card (\d+): ([^\[]+)\s*\[([^\]]*)\], device (\d+): ([^\[]+)\s*\[([^\]]*)\]/g;
    let match: RegExpExecArray | null;

    while ((match = deviceRegex.exec(output)) !== null) {
      const cardNumber = match[1];
      const cardName = match[2].trim();
      const deviceNumber = match[4];
      const deviceName = match[5].trim();

      const usbId = getUsbIdForCard(cardNumber);
      const usbInfo = usbId ? getUsbDeviceInfo(usbId) : undefined;

      devices.push({
        card: `hw:${cardNumber},${deviceNumber}`,
        name: `${cardName} (card ${cardNumber})`,
        description: deviceName,
        usb: !!usbId,
        usbVendor: usbInfo?.vendor,
        usbProduct: usbInfo?.product,
      });
    }
  } catch {
    return devices;
  }

  return devices;
}

function getUsbIdForCard(cardNumber: string): string | null {
  try {
    const usbId = execSync(
      `cat /proc/asound/card${cardNumber}/usbid 2>/dev/null`,
      {
        encoding: "utf-8",
        timeout: 2000,
      },
    ).trim();
    return usbId || null;
  } catch {
    return null;
  }
}

function getUsbDeviceInfo(
  usbId: string,
): { vendor: string; product: string } | null {
  try {
    const output = execSync(`lsusb -d ${usbId} 2>/dev/null`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
    if (!output) return null;
    const parts = output.split(/\s+/).slice(6).join(" ");
    return {
      vendor: USB_VENDOR_MAP[usbId.split(":")[0]] || parts,
      product: parts,
    };
  } catch {
    return null;
  }
}
