---
name: sonect-responsive
description: Ensure every frontend page, component, and layout change is responsive across mobile, tablet, and desktop. Use this skill whenever creating or modifying any UI code in packages/frontend/src/. Every component must work at 375px (mobile), 768px (tablet), and 1280px (desktop) without horizontal overflow, broken layouts, or unusable controls. Trigger whenever you touch files in packages/frontend/src/ that affect layout, markup, or styling.
---

# Sonect Responsive Design

Sonect uses **Tailwind CSS 4** with a mobile-first breakpoint system. Every UI change must be verified at 3 viewport sizes before shipping.

---

## Breakpoint reference

| Prefix   | Min width | Target device                    |
| -------- | --------- | -------------------------------- |
| _(none)_ | 0px       | Mobile (default)                 |
| `sm:`    | 640px     | Large phone / small tablet       |
| `md:`    | 768px     | Tablet                           |
| `lg:`    | 1024px    | Small desktop / landscape tablet |
| `xl:`    | 1280px    | Desktop                          |
| `2xl:`   | 1536px    | Wide desktop                     |

---

## Common responsive patterns in this codebase

### Grids that scale by viewport

```tsx
// Albums, GenreDetail album grid
<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">

// Genres
<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">

// Statistics
<div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

**Rule**: Always start with the smallest column count (mobile-first), then add larger breakpoints. Test that 1-2 items per row look good on mobile.

### Hiding columns on mobile

```tsx
// Track tables — hide artist on md-, hide album on lg-
<TableHead className="hidden md:table-cell">{t("tracks.artist")}</TableHead>
<TableHead className="hidden lg:table-cell">{t("tracks.album")}</TableHead>
<Td className="text-muted-foreground hidden md:table-cell">{track.artist_name}</Td>
```

**Rule**: When a table has too many columns for mobile, hide less essential ones behind `hidden md:table-cell`. Keep title and duration visible at all sizes.

### Flexible cards that wrap

```tsx
// Artists, ArtistAlbums
<div className="flex flex-wrap gap-4">
  <div className="min-w-40 flex-1 sm:max-w-20 md:max-w-40">
```

**Rule**: `min-w-{size}` prevents cards from shrinking too small. `flex-1` allows them to grow. The combination gives a clean wrap without gaps.

### Album artwork

```tsx
<AlbumArtwork aspectRatio="square" className="w-full" />
```

Album art uses `aspectRatio="square"` — the `w-full` ensures it fills its grid cell. On mobile with `grid-cols-2`, each card gets ~half the screen width.

---

## Design rules

1. **No horizontal overflow** — `overflow-x-hidden` on body, no fixed-width containers wider than viewport. If a scrollable horizontal area is intentional (Dashboard scrollable rows), use `ScrollArea` with hidden scrollbar styling.
2. **Touch targets ≥ 44px** — Buttons, icon buttons, links must be at least 44×44px on touch devices. Use `min-h-11 min-w-11` or `p-3` if needed.
3. **Bottom player bar** — Fixed at bottom, slides up with `translate-y-full`/`translate-y-0`. Ensure content above it is not obscured (the player pushes content up when visible).
4. **Sidebar** — Hidden by default on mobile, toggleable via hamburger button. Uses slide animation. Never show sidebar as a permanent overlay on mobile.
5. **Text truncation** — Long album/track titles use `truncate` or lines clamping. Never let text push layout horizontally.
6. **Margins and padding** — All pages use `PageTitle` component which provides `mb-6` bottom spacing. Do not add ad-hoc margin-top to first content element — the spacing is already there.
7. **Images** — Album covers use `aspect-square` or `aspect-3/4`. Never set both width and height as fixed values that would break aspect ratio.

---

## Playwright verification workflow

Before declaring a frontend change done, verify at 3 viewports:

```mjs
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const viewports = [
  { width: 375, height: 812 }, // mobile (iPhone)
  { width: 768, height: 1024 }, // tablet (iPad)
  { width: 1280, height: 800 }, // desktop
];
for (const vp of viewports) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto("http://localhost:5173/PATH", { waitUntil: "networkidle" });
  // Check for horizontal overflow
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  if (overflow) console.error(`Overflow at ${vp.width}px — fix it`);
  await page.screenshot({ path: `/tmp/screenshot-${vp.width}.png` });
  await page.close();
}
await browser.close();
```

Check each screenshot for:

- No horizontal scrollbar
- All content visible and not cut off
- Touch targets reasonably sized
- Grid items stack correctly (not overlapping)
- Text not overflowing containers
- Table columns gracefully hide on small screens

---

## Checklist (every frontend PR)

- [ ] Page renders without overflow at 375px
- [ ] Page renders without overflow at 768px
- [ ] Page renders without overflow at 1280px
- [ ] Grid columns scale correctly (mobile ≤ tablet ≤ desktop)
- [ ] Essential table columns remain visible on mobile
- [ ] Touch targets are usable on mobile (min 44px)
- [ ] Text truncation applied where needed (titles, descriptions)
- [ ] Sidebar hidden by default on mobile
- [ ] Player bar does not obscure content
- [ ] Screenshots taken at all 3 breakpoints
