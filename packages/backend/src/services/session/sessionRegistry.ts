import { SessionPlayer } from "./sessionPlayer.js";
import type { LogService } from "@services/utils/logService";

const IDLE_MS = 30 * 60 * 1000;

let singleton: SessionRegistry | null = null;
let registryOverride: SessionRegistry | null = null;

// Production wiring: the factory (Task 4) calls this once at startup.
export function setGlobalSessionRegistry(r: SessionRegistry): void {
  singleton = r;
}

// Test wiring: point routes/ws at a fresh local registry.
export function registryOverrideForTests(r: SessionRegistry | null): void {
  registryOverride = r;
}

// Resolve the registry used by routes/ws handlers.
export function resolveSessionRegistry(): SessionRegistry {
  if (registryOverride !== null) return registryOverride;
  if (singleton !== null) return singleton;
  throw new Error("SessionRegistry not initialized");
}

export class SessionRegistry {
  private sessions = new Map<string, SessionPlayer>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly logService: LogService) {
    this.cleanupTimer = setInterval(() => this.cleanupIdle(), 60 * 1000);
    if (typeof this.cleanupTimer.unref === "function") {
      this.cleanupTimer.unref();
    }
  }

  getSession(sessionId: string): SessionPlayer | null {
    return this.sessions.get(sessionId) ?? null;
  }

  getOrCreateSession(sessionId: string): SessionPlayer {
    let s = this.sessions.get(sessionId);
    if (!s) {
      s = new SessionPlayer(sessionId, this.logService);
      this.sessions.set(sessionId, s);
    }
    return s;
  }

  removeSession(sessionId: string): void {
    const s = this.sessions.get(sessionId);
    if (s) s.stop();
    this.sessions.delete(sessionId);
  }

  cleanupIdle(): void {
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now - s.getLastActiveAt() > IDLE_MS) {
        s.stop();
        this.sessions.delete(id);
      }
    }
  }

  listSessions(): string[] {
    return [...this.sessions.keys()];
  }

  dispose(): void {
    if (this.cleanupTimer !== null) clearInterval(this.cleanupTimer);
    for (const s of this.sessions.values()) s.stop();
    this.sessions.clear();
  }
}
