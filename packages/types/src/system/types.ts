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

export type LogLevel = "debug" | "info" | "warn" | "error";
