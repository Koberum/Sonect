import type { PlayerReport } from "@repo/types";

const DEFAULT_LIMIT = 100;

/**
 * Buffers playback facts while the WebSocket is unavailable. Reports are
 * flushed in order on reconnect; the oldest entries are dropped if the outage
 * is long enough to fill the buffer.
 */
export class PlayerReportBuffer {
  private reports: PlayerReport[] = [];
  private readonly limit: number;

  constructor(limit = DEFAULT_LIMIT) {
    this.limit = limit;
  }

  push(report: PlayerReport): void {
    this.reports.push(report);
    if (this.reports.length > this.limit) {
      this.reports.splice(0, this.reports.length - this.limit);
    }
  }

  drain(): PlayerReport[] {
    const reports = this.reports;
    this.reports = [];
    return reports;
  }

  clear(): void {
    this.reports = [];
  }
}
