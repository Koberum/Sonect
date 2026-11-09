import { beforeEach, describe, expect, it } from "vitest";
import { queryClient } from "@/lib/queryClient";
import { clearProfileScopedQueries } from "@/features/auth/queries";
import { qk } from "@/lib/queryKeys";

const profileId = "profile-a";

describe("clearProfileScopedQueries", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it("removes every cache that is scoped to the switched profile", () => {
    queryClient.setQueryData(qk.dashboard(profileId), {});
    queryClient.setQueryData(qk.player.queue(profileId), []);
    queryClient.setQueryData(qk.player.settings(profileId), {
      crossfadeSeconds: 4,
    });
    queryClient.setQueryData(qk.player.outputMode(profileId), {
      mode: "browser",
    });
    queryClient.setQueryData(qk.liked.ids(profileId), [1]);
    queryClient.setQueryData(qk.playlists.list(profileId), []);

    clearProfileScopedQueries();

    expect(queryClient.getQueryData(qk.dashboard(profileId))).toBeUndefined();
    expect(
      queryClient.getQueryData(qk.player.queue(profileId)),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(qk.player.settings(profileId)),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(qk.player.outputMode(profileId)),
    ).toBeUndefined();
    expect(queryClient.getQueryData(qk.liked.ids(profileId))).toBeUndefined();
    expect(
      queryClient.getQueryData(qk.playlists.list(profileId)),
    ).toBeUndefined();
  });
});
