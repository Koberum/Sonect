import { describe, expect, it } from "vitest";
import { shouldApplyPlaybackStatus } from "./playbackStatusOrdering";

describe("shouldApplyPlaybackStatus", () => {
  it("accepts statuses without engine ordering (MPD before the fix)", () => {
    expect(shouldApplyPlaybackStatus({}, {})).toBe(true);
  });

  it("rejects an older or equal revision in the same epoch", () => {
    expect(
      shouldApplyPlaybackStatus(
        { epoch: "a", revision: 5 },
        { epoch: "a", revision: 5 },
      ),
    ).toBe(false);
    expect(
      shouldApplyPlaybackStatus(
        { epoch: "a", revision: 5 },
        { epoch: "a", revision: 4 },
      ),
    ).toBe(false);
  });

  it("accepts a newer revision in the same epoch", () => {
    expect(
      shouldApplyPlaybackStatus(
        { epoch: "a", revision: 5 },
        { epoch: "a", revision: 6 },
      ),
    ).toBe(true);
  });

  it("accepts a status from a different epoch", () => {
    expect(
      shouldApplyPlaybackStatus(
        { epoch: "a", revision: 9 },
        { epoch: "b", revision: 1 },
      ),
    ).toBe(true);
  });

  it("accepts the first ordered status", () => {
    expect(shouldApplyPlaybackStatus({}, { epoch: "a", revision: 1 })).toBe(
      true,
    );
  });
});
