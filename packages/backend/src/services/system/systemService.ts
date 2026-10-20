import fs from "fs";
import os from "os";
import path from "path";
import { readAppVersion } from "../utils/appVersion.js";
import { checkTool } from "../utils/utils.js";
import type { LogService } from "../utils/logService.js";
import { MpdConnectionManager } from "@services/mpd/mpdConnectionManager.js";
import type {
  SystemStatus,
  AudioDevice,
  CpuTimes,
  HardwareUsage,
} from "@repo/types/system";

export interface SoundPaths {
  /** Root of the ALSA proc tree, e.g. /proc/asound. */
  procAsound: string;
  /** Live sysfs sound class, e.g. /sys/class/sound. */
  sysSound: string;
  /** USB sysfs device directory, used by the proc fallback. */
  usbDevices: string;
}

export interface SystemServiceOptions {
  logService?: LogService;
  paths?: SoundPaths;
}

const DEFAULT_SOUND_PATHS: SoundPaths = {
  procAsound: "/proc/asound",
  sysSound: "/sys/class/sound",
  usbDevices: "/sys/bus/usb/devices",
};

interface ProcPlaybackPcm {
  cardIndex: number;
  deviceIndex: number;
  description: string;
}

interface UsbInfo {
  vendor?: string;
  product?: string;
}

function readTextFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
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
  private readonly logService?: LogService;
  private readonly paths: SoundPaths;
  private warnedNoAudioDevices = false;

  constructor(
    private readonly mpdConnectionManager: MpdConnectionManager,
    options: SystemServiceOptions = {},
  ) {
    this.logService = options.logService;
    this.paths = options.paths ?? DEFAULT_SOUND_PATHS;
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

  /**
   * Enumerate playback devices from sysfs first. Sysfs is live in containers
   * (Docker masks /proc/asound but not /sys/class/sound), so hotplugged cards
   * appear without a restart. /proc/asound is used as enrichment and as a
   * fallback for bare-metal or unusual environments where sysfs is missing.
   */
  public detectAudioDevices(): AudioDevice[] {
    const sysfsDevices = this.detectFromSysfs();
    if (sysfsDevices.length > 0) {
      this.warnedNoAudioDevices = false;
      return sysfsDevices;
    }

    const procDevices = this.detectFromProc();
    if (procDevices.length > 0) {
      this.warnedNoAudioDevices = false;
      return procDevices;
    }

    if (!this.warnedNoAudioDevices) {
      this.warnedNoAudioDevices = true;
      this.logService?.pushLog(
        "warn",
        `No ALSA playback devices found (checked ${this.paths.sysSound} and ${this.paths.procAsound})`,
      );
    }

    return [];
  }

  private detectFromSysfs(): AudioDevice[] {
    let entries: string[];
    try {
      entries = fs.readdirSync(this.paths.sysSound);
    } catch {
      return [];
    }

    const procDescriptions = new Map(
      this.readProcPlaybackPcms().map((pcm) => [
        `${pcm.cardIndex}-${pcm.deviceIndex}`,
        pcm.description,
      ]),
    );
    const cardNames = this.readCardNames();
    const playbackPcms = entries
      .map((entry) => /^pcmC(\d+)D(\d+)p$/.exec(entry))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => ({
        cardIndex: Number(match[1]),
        deviceIndex: Number(match[2]),
      }))
      .sort(
        (a, b) => a.cardIndex - b.cardIndex || a.deviceIndex - b.deviceIndex,
      );

    return playbackPcms.map(({ cardIndex, deviceIndex }) => {
      const cardId =
        this.readTrimmed(
          path.join(this.paths.sysSound, `card${cardIndex}`, "id"),
        ) ?? cardNames.get(cardIndex);
      const usbInfo = this.readUsbInfo(cardIndex);
      const description =
        procDescriptions.get(`${cardIndex}-${deviceIndex}`) ??
        usbInfo?.product ??
        cardId ??
        `card ${cardIndex}`;
      const device: AudioDevice = {
        card: this.formatCard(cardId, cardIndex, deviceIndex),
        name: `${cardId ?? `card ${cardIndex}`} (card ${cardIndex})`,
        description,
        usb: usbInfo !== null,
      };

      if (usbInfo?.vendor) device.usbVendor = usbInfo.vendor;
      if (usbInfo?.product) device.usbProduct = usbInfo.product;

      return device;
    });
  }

  private detectFromProc(): AudioDevice[] {
    const playbackPcms = this.readProcPlaybackPcms();
    if (playbackPcms.length === 0) return [];

    const cardNames = this.readCardNames();

    return playbackPcms.map(({ cardIndex, deviceIndex, description }) => {
      const cardId = cardNames.get(cardIndex);
      const usbId = this.readUsbId(cardIndex);
      const device: AudioDevice = {
        card: this.formatCard(cardId, cardIndex, deviceIndex),
        name: `${cardId ?? `card ${cardIndex}`} (card ${cardIndex})`,
        description,
        usb: !!usbId,
      };

      if (usbId) {
        const { vendor, product } = this.resolveUsbNames(usbId);
        if (vendor) device.usbVendor = vendor;
        if (product) device.usbProduct = product;
      }

      return device;
    });
  }

  /**
   * ALSA CARD= names survive card-index changes across reboots and hotplug.
   * Numeric fallback is only used when the kernel gives us no usable id.
   */
  private formatCard(
    cardId: string | undefined,
    cardIndex: number,
    deviceIndex: number,
  ): string {
    if (cardId && !/[,=]/.test(cardId)) {
      return `hw:CARD=${cardId},DEV=${deviceIndex}`;
    }
    return `hw:${cardIndex},${deviceIndex}`;
  }

  /**
   * /proc/asound/pcm playback lines look like:
   *   00-00: ALC671 Analog : ALC671 Analog : playback 1 : capture 1
   * The name is repeated before the `: playback` marker; keep the first part.
   */
  private readProcPlaybackPcms(): ProcPlaybackPcm[] {
    const pcm = readTextFile(path.join(this.paths.procAsound, "pcm"));
    if (!pcm) return [];

    const playbackPcms: ProcPlaybackPcm[] = [];
    for (const line of pcm.split("\n")) {
      const match = /^(\d+)-(\d+):\s*(.+?)\s*:\s*playback/.exec(line);
      if (!match) continue;

      playbackPcms.push({
        cardIndex: Number(match[1]),
        deviceIndex: Number(match[2]),
        description: match[3].split(" : ")[0].trim(),
      });
    }

    return playbackPcms;
  }

  // /proc/asound/cards lines look like:
  //    0 [PCH            ]: HDA-Intel - HDA Intel PCH
  private readCardNames(): Map<number, string> {
    const names = new Map<number, string>();
    const cards = readTextFile(path.join(this.paths.procAsound, "cards"));
    if (!cards) return names;

    for (const line of cards.split("\n")) {
      const match = /^\s*(\d+)\s*\[([^\]]+)\]/.exec(line);
      if (!match) continue;
      names.set(Number(match[1]), match[2].trim());
    }

    return names;
  }

  private readUsbId(cardIndex: number): string | null {
    const content = readTextFile(
      path.join(this.paths.procAsound, `card${cardIndex}`, "usbid"),
    );
    const usbId = content?.trim();
    return usbId ? usbId : null;
  }

  /**
   * Resolve USB metadata from the card's device symlink. The symlink usually
   * points at the USB interface (e.g. .../1-1/1-1:1.0); the parent holds
   * idVendor/idProduct/manufacturer/product. Some kernels point directly at
   * the USB device instead, so both the resolved node and its parent are
   * checked. Missing metadata only disables the USB labels, never the device.
   */
  private readUsbInfo(cardIndex: number): UsbInfo | null {
    let resolved: string;
    try {
      resolved = fs.realpathSync(
        path.join(this.paths.sysSound, `card${cardIndex}`, "device"),
      );
    } catch {
      return this.readUsbInfoFromProc(cardIndex);
    }

    const parent = path.dirname(resolved);
    let vendorId: string | undefined;
    let productId: string | undefined;

    for (const dir of [resolved, parent]) {
      const uevent = readTextFile(path.join(dir, "uevent"));
      const match = uevent?.match(
        /^PRODUCT=([0-9a-f]+)\/([0-9a-f]+)(?:\/|$)/im,
      );
      if (match) {
        vendorId = match[1];
        productId = match[2];
        break;
      }

      const entryVendor = this.readTrimmed(path.join(dir, "idVendor"));
      const entryProduct = this.readTrimmed(path.join(dir, "idProduct"));
      if (entryVendor && entryProduct) {
        vendorId = entryVendor;
        productId = entryProduct;
        break;
      }
    }

    if (!vendorId || !productId) {
      return this.readUsbInfoFromProc(cardIndex);
    }

    const manufacturer =
      this.readTrimmed(path.join(parent, "manufacturer")) ??
      this.readTrimmed(path.join(resolved, "manufacturer"));
    const product =
      this.readTrimmed(path.join(parent, "product")) ??
      this.readTrimmed(path.join(resolved, "product"));

    return { vendor: manufacturer, product };
  }

  private readUsbInfoFromProc(cardIndex: number): UsbInfo | null {
    const usbId = this.readUsbId(cardIndex);
    if (!usbId) return null;
    return this.resolveUsbNames(usbId);
  }

  // Best-effort resolution of human-readable USB names from sysfs. The
  // /proc/asound/cardN/usbid file is "vendorId:productId" in hex; we scan
  // /sys/bus/usb/devices for a matching device. Missing sysfs just leaves
  // the names undefined.
  private resolveUsbNames(usbId: string): UsbInfo {
    const [vendorId, productId] = usbId.toLowerCase().split(":");
    if (!vendorId || !productId) return {};

    let entries: string[];
    try {
      entries = fs.readdirSync(this.paths.usbDevices);
    } catch {
      return {};
    }

    for (const entry of entries) {
      const base = path.join(this.paths.usbDevices, entry);
      try {
        const entryVendor = fs
          .readFileSync(path.join(base, "idVendor"), "utf-8")
          .trim()
          .toLowerCase();
        const entryProduct = fs
          .readFileSync(path.join(base, "idProduct"), "utf-8")
          .trim()
          .toLowerCase();
        if (entryVendor !== vendorId || entryProduct !== productId) continue;

        return {
          vendor: this.readTrimmed(path.join(base, "manufacturer")),
          product: this.readTrimmed(path.join(base, "product")),
        };
      } catch {
        continue;
      }
    }

    return {};
  }

  private readTrimmed(filePath: string): string | undefined {
    const content = readTextFile(filePath);
    const value = content?.trim();
    return value ? value : undefined;
  }
}
