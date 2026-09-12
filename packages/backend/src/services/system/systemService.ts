import { execSync } from "child_process";
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

export interface SystemServiceInterface {
  getSystemStatus(): SystemStatus;
  getHardwareUsage(): HardwareUsage;
  detectAudioDevices(): AudioDevice[];
  checkTool(name: string): boolean;
  getUsbDeviceInfo(usbId: string): { vendor: string; product: string } | null;
  getUsbIdForCard(cardNumber: string): string | null;
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

    const cards = tools.aplay ? this.detectAudioDevices() : [];

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
        /card (\d+): ([^[]+)\s*\[([^\]]*)\], device (\d+): ([^[]+)\s*\[([^\]]*)\]/g;
      let match: RegExpExecArray | null;

      while ((match = deviceRegex.exec(output)) !== null) {
        const cardNumber = match[1];
        const cardName = match[2].trim();
        const deviceNumber = match[4];
        const deviceName = match[5].trim();

        const usbId = this.getUsbIdForCard(cardNumber);
        const usbInfo = usbId ? this.getUsbDeviceInfo(usbId) : undefined;

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

  public getUsbIdForCard(cardNumber: string): string | null {
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

  public getUsbDeviceInfo(
    usbId: string,
  ): { vendor: string; product: string } | null {
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
}
