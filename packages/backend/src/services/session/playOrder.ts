import type { RepeatMode } from "@repo/types";

export type ShuffleFn = <T>(items: readonly T[]) => T[];

function defaultShuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Playback order for one queue. It mirrors MPD's random/repeat/single model:
 * - enabling random reshuffles everything and puts the current item first;
 * - items appended while random insert anywhere after the current one;
 * - repeat all wraps and reshuffles at each pass;
 * - repeat one stays on the current item.
 */
export class PlayOrder<T> {
  private order: T[] = [];
  private cursor = -1;
  private randomEnabled = false;
  private repeatMode: RepeatMode = "off";
  private nextCycle: T[] | null = null;

  constructor(
    private readonly shuffle: ShuffleFn = defaultShuffle,
    private readonly rng: () => number = Math.random,
  ) {}

  get random(): boolean {
    return this.randomEnabled;
  }

  get repeat(): RepeatMode {
    return this.repeatMode;
  }

  get length(): number {
    return this.order.length;
  }

  get current(): T | null {
    return this.cursor >= 0 ? (this.order[this.cursor] ?? null) : null;
  }

  reset(natural: readonly T[], current: T | null): void {
    this.order = this.randomEnabled
      ? this.withCurrentFirst(natural, current)
      : [...natural];
    this.cursor = current ? this.order.indexOf(current) : this.firstIndex();
    this.nextCycle = null;
  }

  setRandom(enabled: boolean, natural: readonly T[], current: T | null): void {
    if (enabled === this.randomEnabled) return;
    this.randomEnabled = enabled;
    this.nextCycle = null;
    if (enabled) {
      this.order = this.withCurrentFirst(natural, current);
      this.cursor = current ? 0 : -1;
    } else {
      this.order = [...natural];
      this.cursor = current ? this.order.indexOf(current) : this.firstIndex();
    }
  }

  setRepeat(mode: RepeatMode): void {
    if (mode === this.repeatMode) return;
    this.repeatMode = mode;
    this.nextCycle = null;
  }

  /** Keeps natural order after a queue move while shuffle is off. */
  setNaturalOrder(natural: readonly T[], current: T | null): void {
    if (this.randomEnabled) return;
    this.order = [...natural];
    this.cursor = current ? this.order.indexOf(current) : this.firstIndex();
    this.nextCycle = null;
  }

  append(item: T): void {
    if (!this.randomEnabled) {
      this.order.push(item);
      this.nextCycle = null;
      return;
    }
    const min = this.cursor < 0 ? 0 : this.cursor + 1;
    const max = this.order.length;
    const at = min + Math.floor(this.rng() * (max - min + 1));
    this.order.splice(at, 0, item);
    this.nextCycle = null;
  }

  appendMany(items: readonly T[]): void {
    for (const item of items) this.append(item);
  }

  remove(item: T): void {
    const index = this.order.indexOf(item);
    if (index < 0) return;
    this.order.splice(index, 1);
    if (index < this.cursor) {
      this.cursor -= 1;
    } else if (index === this.cursor && this.cursor >= this.order.length) {
      this.cursor = this.order.length - 1;
    }
    if (this.order.length === 0) this.cursor = -1;
    this.nextCycle = null;
  }

  /**
   * Selects an item explicitly. While playing, MPD moves it right after the
   * current order entry; while stopped it becomes the first item.
   */
  playAt(item: T, playing: boolean): void {
    const index = this.order.indexOf(item);
    if (index < 0) this.order.push(item);
    if (!this.randomEnabled) {
      this.cursor = this.order.indexOf(item);
      this.nextCycle = null;
      return;
    }

    const from = this.order.indexOf(item);
    const [moved] = this.order.splice(from, 1);
    if (from < this.cursor) this.cursor -= 1;
    if (playing && this.cursor >= 0) {
      this.order.splice(this.cursor + 1, 0, moved);
      this.cursor += 1;
    } else {
      this.order.unshift(moved);
      this.cursor = 0;
    }
    this.nextCycle = null;
  }

  advance(): T | null {
    if (this.order.length === 0) return null;
    if (this.repeatMode === "one" && this.cursor >= 0) {
      return this.current;
    }
    if (this.cursor + 1 < this.order.length) {
      this.cursor += 1;
      return this.current;
    }
    if (this.repeatMode === "all") {
      this.order = this.nextCycle ?? this.shuffleOrder();
      this.nextCycle = null;
      this.cursor = 0;
      return this.current;
    }
    return null;
  }

  previous(): T | null {
    if (this.order.length === 0) return null;
    if (this.cursor > 0) {
      this.cursor -= 1;
      return this.current;
    }
    if (this.repeatMode === "all") {
      this.cursor = this.order.length - 1;
      return this.current;
    }
    return this.current;
  }

  /**
   * The next item without moving. At a repeat boundary it precomputes the next
   * cycle so the browser can preload the first item and crossfade into it.
   */
  peekNext(): T | null {
    if (this.order.length === 0) return null;
    if (this.repeatMode === "one" && this.cursor >= 0) {
      return this.current;
    }
    if (this.cursor + 1 < this.order.length) {
      return this.order[this.cursor + 1] ?? null;
    }
    if (this.repeatMode === "all") {
      this.nextCycle ??= this.shuffleOrder();
      return this.nextCycle[0] ?? null;
    }
    return null;
  }

  restart(): T | null {
    if (this.order.length === 0) return null;
    if (this.randomEnabled) this.order = this.shuffleOrder();
    this.cursor = 0;
    this.nextCycle = null;
    return this.current;
  }

  toArray(): T[] {
    return [...this.order];
  }

  private firstIndex(): number {
    return this.order.length > 0 ? 0 : -1;
  }

  private shuffleOrder(): T[] {
    return this.randomEnabled ? this.shuffle(this.order) : [...this.order];
  }

  private withCurrentFirst(natural: readonly T[], current: T | null): T[] {
    if (!current) return this.shuffle(natural);
    return [
      current,
      ...this.shuffle(natural.filter((item) => item !== current)),
    ];
  }
}
