/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readTheme(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8");
}

const themes = [
  { id: "sonect", css: readTheme("./sonect.css") },
  { id: "graphite", css: readTheme("./graphite.css") },
  { id: "ocean", css: readTheme("./ocean.css") },
];

function tokens(css: string): Set<string> {
  return new Set([...css.matchAll(/--([\w-]+)\s*:/g)].map((match) => match[1]));
}

describe("theme token sheets", () => {
  const expected = tokens(themes[0].css);

  it("reads a non-empty token sheet", () => {
    expect(expected.size).toBeGreaterThan(40);
  });

  for (const { id, css } of themes) {
    it(`${id} defines the same tokens as sonect`, () => {
      expect([...tokens(css)].sort()).toEqual([...expected].sort());
    });

    it(`${id} has light and dark selectors`, () => {
      expect(css).toContain(`[data-theme="${id}"]`);
      expect(css).toContain(`[data-theme="${id}"].dark`);
    });
  }
});
