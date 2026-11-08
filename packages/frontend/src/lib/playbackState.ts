import type { PlaybackStatus } from "@repo/types";
import { DEFAULT_VOLUME } from "@/lib/volume";

export const defaultPlayerState: PlaybackStatus = {
  elapsed: 0,
  duration: 0,
  volume: DEFAULT_VOLUME,
  repeat: false,
  random: false,
  single: false,
  consume: false,
  state: "stop",
  queueLength: 0,
};
