export type PlaybackStatusOrder = {
  epoch?: string;
  revision?: number;
};

/**
 * Returns whether an incoming status is new enough to replace the current one.
 * Statuses without ordering information (legacy/MPD) are always accepted;
 * once the backend provides (epoch, revision), an older revision in the same
 * epoch is ignored so a slow HTTP response cannot roll playback back.
 */
export function shouldApplyPlaybackStatus(
  previous: PlaybackStatusOrder,
  next: PlaybackStatusOrder,
): boolean {
  if (next.epoch === undefined || next.revision === undefined) return true;
  if (previous.epoch !== next.epoch) return true;
  if (previous.revision === undefined) return true;
  return next.revision > previous.revision;
}
