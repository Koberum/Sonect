import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VOLUME,
  clampVolume,
  hasVolumePreference,
  loadVolumePreference,
  resolveVolumeIcon,
  saveVolumePreference,
  volumeToGain,
} from "./volume";

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe("volume helpers", () => {
  it("uses a perceptual curve", () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(50)).toBe(0.25);
    expect(volumeToGain(100)).toBe(1);
  });

  it("clamps and rounds volume values", () => {
    expect(clampVolume(-4)).toBe(0);
    expect(clampVolume(65.4)).toBe(65);
    expect(clampVolume(140)).toBe(100);
  });

  it("resolves the icon state", () => {
    expect(resolveVolumeIcon(65, true)).toBe("mute");
    expect(resolveVolumeIcon(0, false)).toBe("mute");
    expect(resolveVolumeIcon(20, false)).toBe("low");
    expect(resolveVolumeIcon(50, false)).toBe("medium");
    expect(resolveVolumeIcon(80, false)).toBe("high");
  });
});

describe("volume preference storage", () => {
  it("returns the 65% default when nothing is stored", () => {
    expect(loadVolumePreference(memoryStorage())).toEqual({
      volume: DEFAULT_VOLUME,
      muted: false,
      lastVolume: DEFAULT_VOLUME,
    });
  });

  it("round-trips a valid preference", () => {
    const storage = memoryStorage();
    saveVolumePreference({ volume: 42, muted: true, lastVolume: 42 }, storage);
    expect(loadVolumePreference(storage)).toEqual({
      volume: 42,
      muted: true,
      lastVolume: 42,
    });
    expect(hasVolumePreference(storage)).toBe(true);
  });

  it("clamps stored values and ignores corrupt JSON", () => {
    const storage = memoryStorage({
      "sonect.volume": JSON.stringify({
        volume: 140,
        muted: true,
        lastVolume: -10,
      }),
    });
    expect(loadVolumePreference(storage)).toEqual({
      volume: 100,
      muted: true,
      lastVolume: DEFAULT_VOLUME,
    });

    storage.setItem("sonect.volume", "{not-json");
    expect(loadVolumePreference(storage).volume).toBe(DEFAULT_VOLUME);
  });

  it("never throws when storage is unavailable", () => {
    const broken = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    } as unknown as Storage;

    expect(loadVolumePreference(broken).volume).toBe(DEFAULT_VOLUME);
    expect(() =>
      saveVolumePreference(
        { volume: 30, muted: false, lastVolume: 30 },
        broken,
      ),
    ).not.toThrow();
  });
});
