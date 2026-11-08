/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { VOLUME_STORAGE_KEY } from "@/lib/volume";
import { useVolumePreference } from "./use-volume-preference";

describe("useVolumePreference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts at 65% when nothing is stored", () => {
    const { result } = renderHook(() => useVolumePreference());

    expect(result.current.volume).toBe(65);
    expect(result.current.effectiveVolume).toBe(65);
    expect(result.current.muted).toBe(false);
    expect(result.current.hasStoredPreference).toBe(false);
  });

  it("persists volume changes", () => {
    const { result } = renderHook(() => useVolumePreference());

    act(() => result.current.setVolume(40));

    expect(result.current.volume).toBe(40);
    expect(result.current.effectiveVolume).toBe(40);
    expect(
      JSON.parse(localStorage.getItem(VOLUME_STORAGE_KEY) ?? "{}"),
    ).toEqual({
      volume: 40,
      muted: false,
      lastVolume: 40,
    });
  });

  it("remembers the last volume across mute/unmute", () => {
    const { result } = renderHook(() => useVolumePreference());

    act(() => result.current.setVolume(55));
    act(() => result.current.toggleMute());

    expect(result.current.muted).toBe(true);
    expect(result.current.effectiveVolume).toBe(0);
    expect(result.current.lastVolume).toBe(55);

    act(() => result.current.toggleMute());

    expect(result.current.muted).toBe(false);
    expect(result.current.volume).toBe(55);
    expect(result.current.effectiveVolume).toBe(55);
  });

  it("keeps mute while accepting a remote volume", () => {
    const { result } = renderHook(() => useVolumePreference());

    act(() => result.current.setVolume(55));
    act(() => result.current.toggleMute());
    act(() => result.current.applyServerVolume(70));

    expect(result.current.muted).toBe(true);
    expect(result.current.effectiveVolume).toBe(0);
    expect(result.current.lastVolume).toBe(70);

    act(() => result.current.toggleMute());

    expect(result.current.volume).toBe(70);
  });

  it("unmutes from zero using the remembered volume", () => {
    const { result } = renderHook(() => useVolumePreference());

    act(() => result.current.setVolume(45));
    act(() => result.current.setVolume(0));
    expect(result.current.volume).toBe(0);

    act(() => result.current.toggleMute());

    expect(result.current.volume).toBe(45);
  });

  it("resets to the 65% default", () => {
    const { result } = renderHook(() => useVolumePreference());

    act(() => result.current.setVolume(10));
    act(() => result.current.resetVolume());

    expect(result.current.volume).toBe(65);
    expect(result.current.muted).toBe(false);
  });
});
