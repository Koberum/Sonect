/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrackWithRelations } from "@repo/types/catalog";
import { renderWithProviders } from "@/test/render";

const mocks = vi.hoisted(() => ({ play: vi.fn() }));

vi.mock("@/features/player/usePlayTrack", () => ({
  usePlayTrack: () => ({ play: mocks.play, addToQueue: vi.fn() }),
}));

vi.mock("@/features/liked/useToggleLike", () => ({
  useToggleLike: () => ({ liked: false, isPending: false, toggle: vi.fn() }),
}));

vi.mock("@/features/playlists/components/add-to-playlist-dialog", () => ({
  AddToPlaylistDialog: () => null,
}));

import { TrackActionsMenu } from "./track-actions-menu";

const track: TrackWithRelations = {
  id: 1,
  file: "x/Album/01.flac",
  title: "Song",
  artist_name: "Artist",
  album_title: "Album",
  sample_rate: 48000,
  bits_per_sample: 24,
  channels: 2,
};

describe("TrackActionsMenu", () => {
  it("opens track info from the desktop menu", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TrackActionsMenu track={track} />);

    const triggers = screen.getAllByRole("button", { name: "Track actions" });
    await user.click(triggers[0]);
    await user.click(screen.getByRole("menuitem", { name: "Info" }));

    expect(
      await screen.findByRole("heading", { name: "Details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("48 kHz")).toBeInTheDocument();
    expect(mocks.play).not.toHaveBeenCalled();
  });

  it("opens track info from the mobile sheet without starting playback", async () => {
    const user = userEvent.setup();
    renderWithProviders(<TrackActionsMenu track={track} />);

    const triggers = screen.getAllByRole("button", { name: "Track actions" });
    await user.click(triggers[1]);
    await user.click(await screen.findByRole("button", { name: "Info" }));

    expect(
      await screen.findByRole("heading", { name: "Details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("24 bit")).toBeInTheDocument();
    expect(mocks.play).not.toHaveBeenCalled();
  });
});
