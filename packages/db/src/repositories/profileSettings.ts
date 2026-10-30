import { eq } from "drizzle-orm";
import { db } from "../connection.js";
import { profileSettings } from "../tables.js";

export const DEFAULT_CROSSFADE_SECONDS = 0;
export const MAX_CROSSFADE_SECONDS = 30;

export type ProfilePlaybackSettings = {
  crossfadeSeconds: number;
};

export const profileSettingsDb = {
  get(profileId: string): ProfilePlaybackSettings {
    const row = db()
      .select()
      .from(profileSettings)
      .where(eq(profileSettings.profile_id, profileId))
      .get();
    return {
      crossfadeSeconds: row?.crossfade_seconds ?? DEFAULT_CROSSFADE_SECONDS,
    };
  },

  setCrossfade(profileId: string, seconds: number): ProfilePlaybackSettings {
    const value = Math.max(
      0,
      Math.min(MAX_CROSSFADE_SECONDS, Math.round(seconds)),
    );
    db()
      .insert(profileSettings)
      .values({
        profile_id: profileId,
        crossfade_seconds: value,
        updated_at: Date.now(),
      })
      .onConflictDoUpdate({
        target: profileSettings.profile_id,
        set: { crossfade_seconds: value, updated_at: Date.now() },
      })
      .run();
    return { crossfadeSeconds: value };
  },
};
