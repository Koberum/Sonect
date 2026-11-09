import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null without a timestamp", () => {
    expect(formatRelativeTime(null)).toBeNull();
  });

  it("formats a recent timestamp as now", () => {
    expect(formatRelativeTime("2026-11-09T12:00:00Z")).toBe("now");
  });

  it("formats an hour-old timestamp", () => {
    expect(formatRelativeTime("2026-11-09T11:00:00Z")).toBe("1 hour ago");
  });
});
