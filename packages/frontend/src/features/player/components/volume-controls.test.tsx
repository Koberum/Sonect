/** @vitest-environment jsdom */
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const state = vi.hoisted(() => ({
  coarse: false,
  engine: {
    isActiveBrowser: true,
    volume: 65,
    muted: false,
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    resetVolume: vi.fn(),
  },
  playback: {
    playbackStatus: { volume: 65 },
    applyPlaybackStatus: vi.fn(),
  },
  persistVolume: vi.fn().mockResolvedValue({ volume: 65 }),
}));

vi.mock("react-responsive", () => ({
  useMediaQuery: () => state.coarse,
}));

vi.mock("@/features/player/player-engine-context", () => ({
  usePlayerEngine: () => state.engine,
}));

vi.mock("@/components/playback-context", () => ({
  usePlaybackContext: () => state.playback,
}));

vi.mock("@/features/player/api", () => ({
  setVolume: state.persistVolume,
}));

import { PlayerVolumeControls } from "./volume-controls";

function renderControl(variant?: "inline") {
  return renderWithProviders(<PlayerVolumeControls variant={variant} />);
}

describe("PlayerVolumeControls", () => {
  beforeEach(() => {
    state.coarse = false;
    state.engine.volume = 65;
    state.engine.muted = false;
    state.engine.isActiveBrowser = true;
    state.playback.playbackStatus.volume = 65;
    vi.clearAllMocks();
  });

  it("renders an accessible volume button and toggles mute", async () => {
    const user = userEvent.setup();
    renderControl();

    const button = screen.getByRole("button", { name: "Volume" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);

    expect(state.engine.toggleMute).toHaveBeenCalledTimes(1);
  });

  it("opens on focus and exposes a vertical slider", () => {
    renderControl();

    const button = screen.getByRole("button", { name: "Volume" });
    fireEvent.focus(button);

    expect(button).toHaveAttribute("aria-expanded", "true");
    const slider = screen.getByRole("slider", { name: "Volume" });
    expect(slider).toHaveAttribute("aria-orientation", "vertical");
  });

  it("adjusts with arrows, Shift, Home and End", async () => {
    const user = userEvent.setup();
    renderControl();

    const button = screen.getByRole("button", { name: "Volume" });
    fireEvent.focus(button);
    const slider = screen.getByRole("slider", { name: "Volume" });
    slider.focus();

    await user.keyboard("{ArrowUp}");
    expect(state.engine.setVolume).toHaveBeenLastCalledWith(70);

    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(state.engine.setVolume).toHaveBeenLastCalledWith(66);

    await user.keyboard("{Home}");
    expect(state.engine.setVolume).toHaveBeenLastCalledWith(0);

    await user.keyboard("{End}");
    expect(state.engine.setVolume).toHaveBeenLastCalledWith(100);
  });

  it("resets to 65% on double click", () => {
    renderControl();

    fireEvent.focus(screen.getByRole("button", { name: "Volume" }));
    fireEvent.doubleClick(screen.getByRole("slider", { name: "Volume" }));

    expect(state.engine.resetVolume).toHaveBeenCalledTimes(1);
  });

  it("adjusts by 5% on wheel and prevents page scroll", () => {
    renderControl();

    const button = screen.getByRole("button", { name: "Volume" });
    const event = new WheelEvent("wheel", {
      deltaY: -1,
      bubbles: true,
      cancelable: true,
    });
    const prevented = !button.dispatchEvent(event);

    expect(prevented).toBe(true);
    expect(state.engine.setVolume).toHaveBeenCalledWith(70);
  });

  it("waits 300 ms before closing after hover", () => {
    vi.useFakeTimers();
    try {
      renderControl();
      const button = screen.getByRole("button", { name: "Volume" });

      fireEvent.mouseEnter(button);
      expect(button).toHaveAttribute("aria-expanded", "true");

      fireEvent.mouseLeave(button);
      act(() => vi.advanceTimersByTime(299));
      expect(button).toHaveAttribute("aria-expanded", "true");

      act(() => vi.advanceTimersByTime(1));
      expect(button).toHaveAttribute("aria-expanded", "false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("stays open while dragging and shows the percentage", () => {
    vi.useFakeTimers();
    try {
      renderControl();
      const button = screen.getByRole("button", { name: "Volume" });
      fireEvent.focus(button);
      const slider = screen.getByRole("slider", { name: "Volume" });

      fireEvent.pointerDown(slider);
      expect(screen.getByText("65%")).toBeInTheDocument();

      fireEvent.mouseLeave(button);
      act(() => vi.advanceTimersByTime(400));
      expect(button).toHaveAttribute("aria-expanded", "true");

      fireEvent.pointerUp(slider);
      act(() => vi.advanceTimersByTime(300));
      expect(button).toHaveAttribute("aria-expanded", "false");
    } finally {
      vi.useRealTimers();
    }
  });

  it("is hidden for coarse pointers", () => {
    state.coarse = true;
    renderControl();

    expect(
      screen.queryByRole("button", { name: "Volume" }),
    ).not.toBeInTheDocument();
  });

  it("stays visible with a horizontal slider on coarse pointers", () => {
    state.coarse = true;
    renderControl("inline");

    const slider = screen.getByRole("slider", { name: "Volume" });
    expect(slider).toHaveAttribute("aria-orientation", "horizontal");
    expect(screen.getByRole("button", { name: "Volume" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("toggles mute from the inline volume icon", async () => {
    const user = userEvent.setup();
    state.coarse = true;
    renderControl("inline");

    await user.click(screen.getByRole("button", { name: "Volume" }));

    expect(state.engine.toggleMute).toHaveBeenCalledTimes(1);
  });

  it("adjusts the inline slider with arrow keys", async () => {
    const user = userEvent.setup();
    state.coarse = true;
    renderControl("inline");

    screen.getByRole("slider", { name: "Volume" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(state.engine.setVolume).toHaveBeenLastCalledWith(70);
  });

  it("persists inline volume changes for a passive device", async () => {
    const user = userEvent.setup();
    state.coarse = true;
    state.engine.isActiveBrowser = false;
    state.playback.playbackStatus.volume = 65;
    renderControl("inline");

    screen.getByRole("slider", { name: "Volume" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(state.persistVolume).toHaveBeenCalledWith(70);
  });
});
