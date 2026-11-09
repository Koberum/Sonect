import { afterEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/lib/queryClient";
import { qk } from "@/lib/queryKeys";
import { playlistMutations } from "./queries";

describe("playlistMutations.removeTrack", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates the playlist list so counts and covers refresh", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const options = playlistMutations.removeTrack("profile-a");

    options.onSuccess?.(undefined, { playlistId: 7, ptId: 3 }, undefined, {
      client: queryClient,
      meta: undefined,
    });

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: qk.playlists.list("profile-a"),
    });
  });
});
