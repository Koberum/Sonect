import { describe, expect, it } from "vitest";
import { nextRepeatMode } from "./repeat-mode";

describe("nextRepeatMode", () => {
  it("cycles off → all → one → off", () => {
    expect(nextRepeatMode("off")).toBe("all");
    expect(nextRepeatMode("all")).toBe("one");
    expect(nextRepeatMode("one")).toBe("off");
  });
});
