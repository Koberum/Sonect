const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;
export const MAX_ENTRIES = 10_000;

type Attempt = {
  failures: number;
  windowStart: number;
  blockedUntil: number;
};

export type ThrottleCheck =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

function isExpired(entry: Attempt, now: number): boolean {
  return entry.blockedUntil <= now && now - entry.windowStart > WINDOW_MS;
}

export class LoginThrottle {
  private readonly attempts = new Map<string, Attempt>();

  private enforceCap(): void {
    while (this.attempts.size > MAX_ENTRIES) {
      const oldest = this.attempts.keys().next().value;
      if (oldest === undefined) break;
      this.attempts.delete(oldest);
    }
  }

  private prune(now: number): void {
    for (const [key, entry] of this.attempts) {
      if (isExpired(entry, now)) this.attempts.delete(key);
    }
    this.enforceCap();
  }

  check(key: string, now = Date.now()): ThrottleCheck {
    this.prune(now);
    const entry = this.attempts.get(key);
    if (!entry) return { allowed: true };
    if (entry.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000),
      };
    }
    if (isExpired(entry, now)) {
      this.attempts.delete(key);
    }
    return { allowed: true };
  }

  recordFailure(key: string, now = Date.now()): void {
    this.prune(now);
    const entry = this.attempts.get(key);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
      this.attempts.set(key, {
        failures: 1,
        windowStart: now,
        blockedUntil: 0,
      });
      this.enforceCap();
      return;
    }
    entry.failures += 1;
    if (entry.failures >= MAX_FAILURES) entry.blockedUntil = now + WINDOW_MS;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
