import type { LogLevel } from "@repo/types/system";

export interface LogService {
  pushLog(level: LogLevel, message: string, data?: unknown): void;
  getLogs(): LogEntry[];
  setBroadcaster(fn: (data: unknown) => void): void;
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: unknown;
}

export class LogServiceImpl implements LogService {
  private LOG_LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };

  private MAX_LOGS = 500;
  private logs: LogEntry[] = [];
  private broadcastFn: ((data: unknown) => void) | null = null;

  public shouldLog(level: LogLevel): boolean {
    const configured = (process.env.LOG_LEVEL ?? "info") as LogLevel;
    return this.LOG_LEVEL_ORDER[level] >= this.LOG_LEVEL_ORDER[configured];
  }

  public setBroadcaster(fn: (data: unknown) => void): void {
    this.broadcastFn = fn;
  }

  public pushLog(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = { timestamp: Date.now(), level, message, data };
    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) this.logs.shift();

    const prefix = level.toUpperCase().padEnd(5);
    const ts = new Date(entry.timestamp).toISOString();
    console.log(`[${ts}] ${prefix} ${message}`);

    if (this.broadcastFn) {
      try {
        this.broadcastFn({ type: "log", entry });
      } catch {
        // ignore broadcast failures
      }
    }
  }

  public getLogs(): LogEntry[] {
    return this.logs;
  }
}

export const logService = new LogServiceImpl();