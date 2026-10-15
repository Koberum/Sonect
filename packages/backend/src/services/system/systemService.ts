import fs from "fs";
import os from "os";
import { readAppVersion } from "../utils/appVersion.js";
import { checkTool } from "../utils/utils.js";
import { MpdConnectionManager } from "@services/mpd/mpdConnectionManager.js";
import type {
  SystemStatus,
  AudioDevice,
  CpuTimes,
  HardwareUsage,
} from "@repo/types/system";

const ASOUND_CARDS_PATH = "/proc/asound/cards";
const ASOUND_PCM_PATH = "/proc/asound/pcm";
const USB_DEVICES_PATH = "/sys/bus/usb/devices";

function readTextFile(path: string): string | null {
  try {
    return fs.readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

export interface SystemServiceInterface {
  getSystemStatus(): SystemStatus;
  getHardwareUsage(): HardwareUsage;
  detectAudioDevices(): AudioDevice[];
  checkTool(name: string): boolean;
}

export class SystemServiceImpl implements SystemServiceInterface {
  private prevCpuTimes: CpuTimes | null = null;
  private mpdConnectionManager: MpdConnectionManager;

  constructor(mpdConnectionManager: MpdConnectionManager) {
    this.mpdConnectionManager = mpdConnectionManager;
  }

  public getHardwareUsage(): HardwareUsage {
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

    if (this.prevCpuTimes) {
      const userDelta = curr.user - this.prevCpuTimes.user;
      const niceDelta = curr.nice - this.prevCpuTimes.nice;
      const sysDelta = curr.sys - this.prevCpuTimes.sys;
      const idleDelta = curr.idle - this.prevCpuTimes.idle;
      const irqDelta = curr.irq - this.prevCpuTimes.irq;
      const totalDelta =
        userDelta + niceDelta + sysDelta + idleDelta + irqDelta;
      if (totalDelta > 0) {
        usage = Math.round((100 * (totalDelta - idleDelta)) / totalDelta);
      }
    }
    this.prevCpuTimes = curr;

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

  public getSystemStatus(): SystemStatus {
    const tools = {
      aplay: this.checkTool("aplay"),
      lsusb: this.checkTool("lsusb"),
      systemctl: this.checkTool("systemctl"),
      mpd: this.checkTool("mpd"),
    };

    const cards = this.detectAudioDevices();

    return {
      tools,
      audio: {
        available: cards.length > 0,
        cards,
      },
      mpdConnected: this.mpdConnectionManager.connected,
      setupCompleted: [],
      version: readAppVersion(),
    };
  }

  public checkTool(name: string): boolean {
    return checkTool(name);
  }

  public detectAudioDevices(): AudioDevice[] {
    const devices: AudioDevice[] = [];
    const pcm = readTextFile(ASOUND_PCM_PATH);
    if (!pcm) return devices;

    const cardNames = this.readCardNames();

    // Playback PCM lines look like:
    //   00-00: ALC671 Analog : ALC671 Analog : playback 1 : capture 1
    // The name is repeated before the `: playback` marker; keep the first part.
    for (const line of pcm.split("\n")) {
      const match = /^(\d+)-(\d+):\s*(.+?)\s*:\s*playback/.exec(line);
      if (!match) continue;

      const cardIndex = Number(match[1]);
      const deviceIndex = Number(match[2]);
      const description = match[3].split(" : ")[0].trim();
      const cardName = cardNames.get(cardIndex);
      const usbId = this.readUsbId(cardIndex);

      const device: AudioDevice = {
        card: `hw:${cardIndex},${deviceIndex}`,
        name: `${cardName ?? `card ${cardIndex}`} (card ${cardIndex})`,
        description,
        usb: !!usbId,
      };

      if (usbId) {
        const { vendor, product } = this.resolveUsbNames(usbId);
        if (vendor) device.usbVendor = vendor;
        if (product) device.usbProduct = product;
      }

      devices.push(device);
    }

    return devices;
  }

  // /proc/asound/cards lines look like:
  //    0 [PCH            ]: HDA-Intel - HDA Intel PCH
  private readCardNames(): Map<number, string> {
    const names = new Map<number, string>();
    const cards = readTextFile(ASOUND_CARDS_PATH);
    if (!cards) return names;

    for (const line of cards.split("\n")) {
      const match = /^\s*(\d+)\s*\[([^\]]+)\]/.exec(line);
      if (!match) continue;
      names.set(Number(match[1]), match[2].trim());
    }

    return names;
  }

  private readUsbId(cardIndex: number): string | null {
    const content = readTextFile(`/proc/asound/card${cardIndex}/usbid`);
    const usbId = content?.trim();
    return usbId ? usbId : null;
  }

  // Best-effort resolution of human-readable USB names from sysfs. The
  // /proc/asound/cardN/usbid file is "vendorId:productId" in hex; we scan
  // /sys/bus/usb/devices for a matching device. Missing sysfs (typical
  // inside containers) just leaves the names undefined.
  private resolveUsbNames(usbId: string): {
    vendor?: string;
    product?: string;
  } {
    const [vendorId, productId] = usbId.toLowerCase().split(":");
    if (!vendorId || !productId) return {};

    let entries: string[];
    try {
      entries = fs.readdirSync(USB_DEVICES_PATH);
    } catch {
      return {};
    }

    for (const entry of entries) {
      const base = `${USB_DEVICES_PATH}/${entry}`;
      try {
        const entryVendor = fs
          .readFileSync(`${base}/idVendor`, "utf-8")
          .trim()
          .toLowerCase();
        const entryProduct = fs
          .readFileSync(`${base}/idProduct`, "utf-8")
          .trim()
          .toLowerCase();
        if (entryVendor !== vendorId || entryProduct !== productId) continue;

        return {
          vendor: this.readTrimmed(`${base}/manufacturer`),
          product: this.readTrimmed(`${base}/product`),
        };
      } catch {
        continue;
      }
    }

    return {};
  }

  private readTrimmed(path: string): string | undefined {
    const content = readTextFile(path);
    const value = content?.trim();
    return value ? value : undefined;
  }
}
