/** @vitest-environment jsdom */
import type { LibraryStats } from "@repo/types/catalog";
import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { useStatusCenter } from "../use-status-center";
import { StatusCenter } from "./status-center";

vi.mock("../use-status-center", () => ({
  useStatusCenter: vi.fn(),
}));

const mockedUseStatusCenter = vi.mocked(useStatusCenter);

const stats: LibraryStats = {
  totalTracks: 12480,
  totalArtists: 1204,
  totalAlbums: 892,
  totalPlaylists: 10,
  totalGenres: 20,
  totalDuration: 1000,
  averageDuration: 200,
  earliestYear: 1950,
  latestYear: 2026,
  tracksWithoutAlbum: 0,
  lastSync: null,
};

function mockStatus(
  overrides: Partial<ReturnType<typeof useStatusCenter>> = {},
) {
  mockedUseStatusCenter.mockReturnValue({
    items: [],
    topItem: null,
    stats,
    statsLoading: false,
    statsError: false,
    refetchStats: vi.fn(),
    syncProgress: null,
    isAdmin: true,
    syncNow: vi.fn(),
    syncRunning: false,
    syncPending: false,
    ...overrides,
  });
}

function renderCenter() {
  return renderWithProviders(
    <MemoryRouter>
      <StatusCenter collapsed={false} />
    </MemoryRouter>,
  );
}

describe("StatusCenter", () => {
  beforeEach(() => {
    mockedUseStatusCenter.mockReset();
  });

  it("shows library stats when idle", () => {
    mockStatus();
    renderCenter();

    expect(screen.getByText("Library")).toBeInTheDocument();
    expect(screen.getByText("12,480 tracks")).toBeInTheDocument();
    expect(screen.getByText("892 albums · 1,204 artists")).toBeInTheDocument();
  });

  it("shows the top sync activity", () => {
    const item = {
      id: "sync",
      tone: "activity" as const,
      titleKey: "sync.readingTracks",
      descriptionKey: "sync.runningDescription",
      progress: 64,
      animated: true,
    };
    mockStatus({
      items: [item],
      topItem: item,
      syncProgress: {
        phase: "tracks",
        current: 64,
        total: 100,
        track: null,
      },
    });
    renderCenter();

    expect(screen.getByText("Reading tracks...")).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
  });
});
