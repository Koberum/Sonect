import { describe, expect, it } from "vitest";
import type { PlayerReport } from "@repo/types";
import { PlayerReportBuffer } from "./playerReportBuffer";

function report(elapsed: number): PlayerReport {
  return { event: "playing", state: "play", elapsed };
}

describe("PlayerReportBuffer", () => {
  it("drains queued reports in order and empties the buffer", () => {
    const buffer = new PlayerReportBuffer();

    buffer.push(report(1));
    buffer.push(report(2));

    expect(buffer.drain()).toEqual([report(1), report(2)]);
    expect(buffer.drain()).toEqual([]);
  });

  it("drops the oldest reports when the buffer is full", () => {
    const buffer = new PlayerReportBuffer(2);

    buffer.push(report(1));
    buffer.push(report(2));
    buffer.push(report(3));

    expect(buffer.drain()).toEqual([report(2), report(3)]);
  });

  it("clears queued reports", () => {
    const buffer = new PlayerReportBuffer();

    buffer.push(report(1));
    buffer.clear();

    expect(buffer.drain()).toEqual([]);
  });
});
