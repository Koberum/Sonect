/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDelayedDisconnect } from "./use-delayed-disconnect";

describe("useDelayedDisconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits before reporting a disconnect and resets on reconnect", () => {
    const { result, rerender } = renderHook(
      ({ connected }) => useDelayedDisconnect(connected, 5000),
      { initialProps: { connected: true } },
    );

    expect(result.current).toBe(false);
    rerender({ connected: false });
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(4999));
    expect(result.current).toBe(false);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(true);
    rerender({ connected: true });
    expect(result.current).toBe(false);
  });
});
