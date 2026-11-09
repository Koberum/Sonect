import type { LibrarySyncProgress } from "@repo/types/catalog";
import { describe, expect, it } from "vitest";
import { buildStatusItems, type StatusInputs } from "./status-items";

const base: StatusInputs = {
  syncProgress: null,
  syncError: null,
  disconnected: false,
  isAdmin: true,
};

function progress(
  overrides: Partial<LibrarySyncProgress> = {},
): LibrarySyncProgress {
  return {
    phase: "tracks",
    current: 64,
    total: 100,
    track: { title: "Song", artist: "Artist", album: "Album" },
    ...overrides,
  };
}

describe("buildStatusItems", () => {
  it("returns no items when everything is healthy", () => {
    expect(buildStatusItems(base)).toEqual([]);
  });

  it("maps sync progress to an animated activity item", () => {
    const items = buildStatusItems({
      ...base,
      syncProgress: progress(),
    });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "sync",
      tone: "activity",
      progress: 64,
      animated: true,
    });
  });

  it("keeps sync error details and retry for admins only", () => {
    const admin = buildStatusItems({ ...base, syncError: "disk full" });
    expect(admin[0]).toMatchObject({
      id: "sync",
      tone: "error",
      description: "disk full",
      action: { kind: "sync" },
    });

    const user = buildStatusItems({
      ...base,
      isAdmin: false,
      syncError: "disk full",
    });
    expect(user[0].description).toBeUndefined();
    expect(user[0].action).toBeUndefined();
  });

  it("reports unavailable storage to admins only", () => {
    const storageSources = [
      {
        id: 1,
        name: "Music",
        path: "/music",
        enabled: 1,
        available: false,
      },
      {
        id: 2,
        name: "Archive",
        path: "/archive",
        enabled: 1,
        available: false,
      },
      {
        id: 3,
        name: "Old",
        path: "/old",
        enabled: 0,
        available: false,
      },
    ];
    const admin = buildStatusItems({ ...base, storageSources });
    expect(admin[0]).toMatchObject({
      id: "storage",
      tone: "error",
      description: "Music, Archive",
      action: { kind: "navigate", to: "/settings" },
    });
    expect(
      buildStatusItems({ ...base, isAdmin: false, storageSources }),
    ).toEqual([]);
  });

  it("reports missing audio output, no devices, and offline MPD", () => {
    expect(
      buildStatusItems({
        ...base,
        audioStatus: { card: "hw:CARD=Missing,DEV=0", name: "Speakers" },
        audioDevices: [
          {
            card: "hw:CARD=Other,DEV=0",
            name: "Other",
            description: "Other",
            usb: false,
          },
        ],
        mpdRunning: true,
      })[0],
    ).toMatchObject({
      id: "audio-output",
      tone: "error",
      description: "Speakers",
    });

    expect(
      buildStatusItems({
        ...base,
        audioStatus: { card: "hw:CARD=Missing,DEV=0", name: "Speakers" },
        audioDevices: [],
        mpdRunning: true,
      })[0],
    ).toMatchObject({ id: "audio-devices", tone: "warning" });

    expect(
      buildStatusItems({
        ...base,
        audioStatus: { card: "hw:CARD=OK,DEV=0", name: "Speakers" },
        audioDevices: [
          {
            card: "hw:CARD=OK,DEV=0",
            name: "Speakers",
            description: "Speakers",
            usb: false,
          },
        ],
        mpdRunning: false,
      })[0],
    ).toMatchObject({ id: "audio-engine", tone: "error" });
  });

  it("sorts errors before warnings and activity", () => {
    const items = buildStatusItems({
      ...base,
      disconnected: true,
      syncProgress: progress({ current: 1, total: 2 }),
      storageSources: [
        {
          id: 1,
          name: "Music",
          path: "/music",
          enabled: 1,
          available: false,
        },
      ],
    });
    expect(items.map((item) => item.tone)).toEqual([
      "error",
      "warning",
      "activity",
    ]);
  });
});
