import { afterEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/lib/queryClient";
import { qk } from "@/lib/queryKeys";
import { invalidateCatalogAfterSync } from "./sync-invalidation";

describe("invalidateCatalogAfterSync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invalidates liked songs and playlists after the catalog changes", () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    invalidateCatalogAfterSync(queryClient);

    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.likedRoot() });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: qk.playlistsRoot() });
  });
});
