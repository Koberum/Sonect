import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./format";

describe("formatRelativeTime", () => {
  it("returns null without a timestamp", () => {
    expect(formatRelativeTime(null)).toBeNull();
  });

  it("formats a recent timestamp as now", () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe("now");
  });

  it("formats an hour-old timestamp", () => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(formatRelativeTime(hourAgo)).toBe("1 hour ago");
  });
});
