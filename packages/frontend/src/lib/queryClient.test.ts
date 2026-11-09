import { describe, expect, it } from "vitest";
import { keepPreviousData } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { catalogQueries } from "@/features/catalog/queries";

describe("query placeholders", () => {
  it("does not keep previous data for id-keyed detail queries", () => {
    expect(
      queryClient.getDefaultOptions().queries?.placeholderData,
    ).toBeUndefined();
    expect(catalogQueries.album("1").placeholderData).toBeUndefined();
    expect(catalogQueries.tracksByAlbum("1").placeholderData).toBeUndefined();
  });

  it("keeps previous data while the album sort changes", () => {
    expect(catalogQueries.albumsInfinite("recent").placeholderData).toBe(
      keepPreviousData,
    );
  });
});
