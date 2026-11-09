import { expect } from "chai";
import {
  AUTOPLAY_QUEUE_LOW,
  AUTOPLAY_REFILL_INTERVAL_MS,
  shouldRefillAutoplay,
  type AutoplayRefillInput,
} from "@services/mpd/autoplayPolicy.js";

function input(
  overrides: Partial<AutoplayRefillInput> = {},
): AutoplayRefillInput {
  return {
    state: "play",
    repeat: false,
    hasTrack: true,
    remainingTracks: AUTOPLAY_QUEUE_LOW - 1,
    hasNextSong: true,
    autofillInProgress: false,
    lastAutofillAt: 0,
    now: AUTOPLAY_REFILL_INTERVAL_MS + 1,
    ...overrides,
  };
}

describe("shouldRefillAutoplay", () => {
  it("refills when fewer than five tracks remain", () => {
    expect(shouldRefillAutoplay(input())).to.equal(true);
  });

  it("does not refill while repeat is active", () => {
    expect(shouldRefillAutoplay(input({ repeat: true }))).to.equal(false);
  });

  it("refills when MPD has no next song even in random mode", () => {
    expect(
      shouldRefillAutoplay(input({ remainingTracks: 20, hasNextSong: false })),
    ).to.equal(true);
  });

  it("waits for the refill interval and ignores non-playing states", () => {
    expect(
      shouldRefillAutoplay(input({ now: AUTOPLAY_REFILL_INTERVAL_MS - 1 })),
    ).to.equal(false);
    expect(shouldRefillAutoplay(input({ state: "pause" }))).to.equal(false);
    expect(shouldRefillAutoplay(input({ autofillInProgress: true }))).to.equal(
      false,
    );
  });
});
