/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { TrackWithRelations } from "@repo/types/catalog";
import { renderWithProviders } from "@/test/render";
import { TrackInfoDialog } from "./track-info-dialog";

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

describe("TrackInfoDialog", () => {
  it("renders the track metadata and audio format", () => {
    renderWithProviders(
      <TrackInfoDialog track={track} open onOpenChange={() => {}} />,
    );

    expect(screen.getByText("Song")).toBeInTheDocument();
    expect(screen.getByText("FLAC")).toBeInTheDocument();
    expect(screen.getByText("48 kHz")).toBeInTheDocument();
    expect(screen.getByText("24 bit")).toBeInTheDocument();
    expect(screen.getByText("2 channels")).toBeInTheDocument();
  });

  it("omits the audio section when the track has no quality data", () => {
    renderWithProviders(
      <TrackInfoDialog
        track={{
          ...track,
          sample_rate: null,
          bits_per_sample: null,
          channels: null,
        }}
        open
        onOpenChange={() => {}}
      />,
    );

    expect(screen.queryByText("Audio")).not.toBeInTheDocument();
  });
});
