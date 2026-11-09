import type { PlaybackState } from "@repo/types";

export const AUTOPLAY_QUEUE_LOW = 5;
export const AUTOPLAY_REFILL_INTERVAL_MS = 10_000;

export type AutoplayRefillInput = {
  state: PlaybackState;
  repeat: boolean;
  hasTrack: boolean;
  remainingTracks: number;
  hasNextSong: boolean;
  autofillInProgress: boolean;
  lastAutofillAt: number;
  now: number;
};

/**
 * MPD owns the queue during playback, so it must be told when to extend it.
 * The position-based "few tracks left" check is unreliable in random mode
 * (the next song may be anywhere in the queue); a missing `nextsong` is the
 * authoritative signal that the current random order is exhausted.
 */
export function shouldRefillAutoplay(input: AutoplayRefillInput): boolean {
  if (input.state !== "play") return false;
  if (input.repeat) return false;
  if (!input.hasTrack) return false;
  if (input.autofillInProgress) return false;
  if (input.now - input.lastAutofillAt <= AUTOPLAY_REFILL_INTERVAL_MS) {
    return false;
  }
  return input.remainingTracks < AUTOPLAY_QUEUE_LOW || !input.hasNextSong;
}
