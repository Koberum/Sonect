/** @vitest-environment jsdom */
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const state = vi.hoisted(() => ({
  finePointer: true,
  playback: {
    activeDeviceId: null as string | null,
    activeDeviceName: null as string | null,
    activeDeviceType: null as "mobile" | "desktop" | null,
    myDeviceId: "device-1",
  },
  output: {
    outputMode: "browser" as "browser" | "mpd",
    deviceName: "Creative Pebble",
    isMpdLockedForMe: false,
    changeOutputMode: vi.fn(),
  },
}));

vi.mock("react-responsive", () => ({
  useMediaQuery: () => state.finePointer,
}));

vi.mock("@/components/playback-context", () => ({
  usePlaybackContext: () => state.playback,
}));

vi.mock("@/lib/deviceId", () => ({
  getDeviceName: () => "Chrome on Linux",
  getDeviceType: () => "desktop",
}));

vi.mock("../useOutputMode", () => ({
  useOutputMode: () => state.output,
}));

import { OutputSelector } from "./output-selector";

function renderSelector() {
  return renderWithProviders(<OutputSelector />);
}

function openSelector() {
  fireEvent.click(screen.getByRole("button", { name: "Output" }));
}

describe("OutputSelector", () => {
  beforeEach(() => {
    state.finePointer = true;
    state.playback.activeDeviceId = null;
    state.playback.activeDeviceName = null;
    state.playback.activeDeviceType = null;
    state.playback.myDeviceId = "device-1";
    state.output.outputMode = "browser";
    state.output.deviceName = "Creative Pebble";
    state.output.isMpdLockedForMe = false;
    vi.clearAllMocks();
  });

  it("opens a radiogroup from the trigger and marks the active browser", async () => {
    const user = userEvent.setup();
    renderSelector();

    const trigger = screen.getByRole("button", { name: "Output" });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("radiogroup", { name: "Output" }),
    ).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /This browser/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /Speakers/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("switches output and closes after a selection", async () => {
    const user = userEvent.setup();
    renderSelector();

    await user.click(screen.getByRole("button", { name: "Output" }));
    await user.click(screen.getByRole("radio", { name: /Speakers/ }));

    expect(state.output.changeOutputMode).toHaveBeenCalledWith("mpd");
    await waitFor(() => {
      expect(
        screen.queryByRole("radiogroup", { name: "Output" }),
      ).not.toBeInTheDocument();
    });
  });

  it("disables the speakers option while another session owns it", () => {
    state.output.isMpdLockedForMe = true;
    renderSelector();
    openSelector();

    const speakers = screen.getByRole("radio", { name: /Speakers/ });
    expect(speakers).toBeDisabled();
    expect(screen.getByText("In use by another session")).toBeInTheDocument();
  });

  it("shows a remote browser as the selected, disabled device", () => {
    state.playback.activeDeviceId = "device-2";
    state.playback.activeDeviceName = "Safari on iOS";
    state.playback.activeDeviceType = "mobile";
    renderSelector();
    openSelector();

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    const remote = screen.getByRole("radio", { name: /Safari on iOS/ });
    expect(remote).toHaveAttribute("aria-checked", "true");
    expect(remote).toBeDisabled();
  });

  it("opens on hover for fine pointers and waits before closing", () => {
    vi.useFakeTimers();
    try {
      renderSelector();
      const trigger = screen.getByRole("button", { name: "Output" });

      fireEvent.mouseEnter(trigger);
      expect(
        screen.getByRole("radiogroup", { name: "Output" }),
      ).toBeInTheDocument();

      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(299));
      expect(
        screen.getByRole("radiogroup", { name: "Output" }),
      ).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));
      expect(
        screen.queryByRole("radiogroup", { name: "Output" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not open on hover for coarse pointers but opens on tap", () => {
    state.finePointer = false;
    renderSelector();
    const trigger = screen.getByRole("button", { name: "Output" });

    fireEvent.mouseEnter(trigger);
    expect(
      screen.queryByRole("radiogroup", { name: "Output" }),
    ).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(
      screen.getByRole("radiogroup", { name: "Output" }),
    ).toBeInTheDocument();
  });

  it("stays open while the pointer is inside the popover", () => {
    vi.useFakeTimers();
    try {
      renderSelector();
      const trigger = screen.getByRole("button", { name: "Output" });
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseLeave(trigger);

      act(() => vi.advanceTimersByTime(100));
      const dialog = screen.getByRole("dialog");
      fireEvent.mouseEnter(dialog);
      act(() => vi.advanceTimersByTime(400));
      expect(
        screen.getByRole("radiogroup", { name: "Output" }),
      ).toBeInTheDocument();

      fireEvent.mouseLeave(dialog);
      act(() => vi.advanceTimersByTime(300));
      expect(
        screen.queryByRole("radiogroup", { name: "Output" }),
      ).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
