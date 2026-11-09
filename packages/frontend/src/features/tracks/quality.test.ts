import { describe, expect, it } from "vitest";
import type { TrackWithRelations } from "@repo/types/catalog";
import {
  fileExtension,
  filterAndSortTracks,
  formatQuality,
  formatSampleRate,
  qualityKey,
  qualityOptionsFromTracks,
} from "./quality";

function makeTrack(
  overrides: Partial<TrackWithRelations> = {},
): TrackWithRelations {
  return {
    id: 1,
    file: "a/01.flac",
    title: "Track",
    ...overrides,
  };
}

describe("qualityKey", () => {
  it("encodes both values", () => {
    expect(
      qualityKey(makeTrack({ bits_per_sample: 24, sample_rate: 48000 })),
    ).toBe("24:48000");
  });

  it("keeps an empty side for a missing value", () => {
    expect(
      qualityKey(makeTrack({ bits_per_sample: null, sample_rate: 48000 })),
    ).toBe(":48000");
    expect(
      qualityKey(makeTrack({ bits_per_sample: 24, sample_rate: null })),
    ).toBe("24:");
  });

  it("returns null when neither value is present", () => {
    expect(qualityKey(makeTrack())).toBeNull();
  });
});

describe("formatQuality", () => {
  it("formats both values with the sample rate first", () => {
    expect(
      formatQuality(makeTrack({ bits_per_sample: 24, sample_rate: 48000 })),
    ).toBe("48 kHz / 24 bit");
  });

  it("formats only the available value", () => {
    expect(
      formatQuality(makeTrack({ bits_per_sample: null, sample_rate: 48000 })),
    ).toBe("48 kHz");
    expect(
      formatQuality(makeTrack({ bits_per_sample: 24, sample_rate: null })),
    ).toBe("24 bit");
  });

  it("returns null when neither value is present", () => {
    expect(formatQuality(makeTrack())).toBeNull();
  });
});

describe("formatSampleRate", () => {
  it("keeps a decimal for 44.1 kHz", () => {
    expect(formatSampleRate(44100)).toBe("44.1 kHz");
  });

  it("omits the decimal for whole kHz values", () => {
    expect(formatSampleRate(48000)).toBe("48 kHz");
    expect(formatSampleRate(96000)).toBe("96 kHz");
  });
});

describe("fileExtension", () => {
  it("returns the uppercase extension", () => {
    expect(fileExtension("a/b/01.flac")).toBe("FLAC");
  });

  it("returns undefined without an extension", () => {
    expect(fileExtension("a/b/track")).toBeUndefined();
    expect(fileExtension("a/b/.hidden")).toBeUndefined();
  });
});

describe("qualityOptionsFromTracks", () => {
  it("deduplicates and orders the best quality first", () => {
    expect(
      qualityOptionsFromTracks([
        makeTrack({ id: 1, bits_per_sample: 16, sample_rate: 44100 }),
        makeTrack({ id: 2, bits_per_sample: 24, sample_rate: 48000 }),
        makeTrack({ id: 3, bits_per_sample: 24, sample_rate: 48000 }),
        makeTrack({ id: 4 }),
      ]),
    ).toEqual([
      { key: "24:48000", label: "48 kHz / 24 bit" },
      { key: "16:44100", label: "44.1 kHz / 16 bit" },
    ]);
  });
});

describe("filterAndSortTracks", () => {
  const tracks = [
    makeTrack({ id: 1, bits_per_sample: 24, sample_rate: 48000 }),
    makeTrack({ id: 2, bits_per_sample: 16, sample_rate: 44100 }),
    makeTrack({ id: 3, bits_per_sample: 24, sample_rate: 44100 }),
    makeTrack({ id: 4 }),
  ];

  it("filters by the exact quality key", () => {
    expect(
      filterAndSortTracks(tracks, "24:48000", "none").map((track) => track.id),
    ).toEqual([1]);
  });

  it("sorts by bit depth then sample rate, descending", () => {
    expect(
      filterAndSortTracks(tracks, null, "desc").map((track) => track.id),
    ).toEqual([1, 3, 2, 4]);
  });

  it("sorts ascending and keeps missing values last", () => {
    expect(
      filterAndSortTracks(tracks, null, "asc").map((track) => track.id),
    ).toEqual([2, 3, 1, 4]);
  });

  it("preserves the original order when sorting is off", () => {
    expect(
      filterAndSortTracks(tracks, null, "none").map((track) => track.id),
    ).toEqual([1, 2, 3, 4]);
  });
});
