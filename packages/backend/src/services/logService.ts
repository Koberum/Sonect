type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const configured = (process.env.LOG_LEVEL ?? "info") as LogLevel;
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[configured];
}

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: unknown;
}

const MAX_LOGS = 500;
const logs: LogEntry[] = [];

let broadcastFn: ((data: unknown) => void) | null = null;

export function setBroadcaster(fn: (data: unknown) => void): void {
  broadcastFn = fn;
}

export function pushLog(
  level: LogLevel,
  message: string,
  data?: unknown,
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = { timestamp: Date.now(), level, message, data };
  logs.push(entry);
  if (logs.length > MAX_LOGS) logs.shift();

  const prefix = level.toUpperCase().padEnd(5);
  const ts = new Date(entry.timestamp).toISOString();
  console.log(`[${ts}] ${prefix} ${message}`);

  if (broadcastFn) {
    try {
      broadcastFn({ type: "log", entry });
    } catch {
      // ignore broadcast failures
    }
  }
}

export function getLogs(): LogEntry[] {
  return logs;
}
