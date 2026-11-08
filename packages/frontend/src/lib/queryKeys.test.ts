import { describe, expect, it } from "vitest";
import { qk } from "./queryKeys";

describe("query keys", () => {
  it("scopes player state per profile", () => {
    expect(qk.player.queue("profile-a")).not.toEqual(
      qk.player.queue("profile-b"),
    );
    expect(qk.player.settings("profile-a")).not.toEqual(
      qk.player.settings("profile-b"),
    );
    expect(qk.player.outputMode("profile-a")).not.toEqual(
      qk.player.outputMode("profile-b"),
    );
  });

  it("exposes roots that contain the scoped keys", () => {
    expect(qk.player.queue("profile-a").slice(0, 2)).toEqual(
      qk.player.queueRoot(),
    );
    expect(qk.player.settings("profile-a").slice(0, 2)).toEqual(
      qk.player.settingsRoot(),
    );
    expect(qk.player.outputMode("profile-a").slice(0, 2)).toEqual(
      qk.player.outputModeRoot(),
    );
    expect(qk.liked.ids("profile-a").slice(0, 1)).toEqual(qk.likedRoot());
    expect(qk.playlists.list("profile-a").slice(0, 1)).toEqual(
      qk.playlistsRoot(),
    );
  });
});
