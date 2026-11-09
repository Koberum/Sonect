import type { RepeatMode } from "@repo/types";

/** UI cycle: off → repeat queue → repeat track → off. */
export function nextRepeatMode(mode: RepeatMode): RepeatMode {
  if (mode === "off") return "all";
  if (mode === "all") return "one";
  return "off";
}
