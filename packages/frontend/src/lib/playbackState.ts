import type { PlaybackStatus } from "@repo/types";

export const defaultPlayerState: PlaybackStatus = {
  elapsed: 0,
  duration: 0,
  volume: 0,
  repeat: false,
  random: false,
  single: false,
  consume: false,
  state: "stop",
  queueLength: 0,
};
