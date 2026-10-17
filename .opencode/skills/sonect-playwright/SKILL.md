---
name: sonect-playwright
description: Use Playwright to visually verify, test, or debug the Sonect frontend UI. Use this skill whenever the user asks to check what the UI looks like, verify a frontend change rendered correctly, take a screenshot of a page or component, click through a user flow to confirm it works, or write end-to-end tests. This skill requires the Playwright MCP server (configured in opencode.json) — see setup below. Trigger whenever the user wants to see the frontend, confirm visual output, or validate a UI interaction.
---

# Sonect Playwright — Frontend Visibility

The Playwright MCP server gives the agent eyes: it can navigate to the Vite dev server, take screenshots, click elements, fill inputs, and verify what actually rendered.

## Prerequisites

The frontend dev server must be running:

```bash
pnpm frontend:dev   # starts on http://localhost:5173
```

The Playwright MCP server is already configured in `/workspace/opencode.json` (`mcp.playwright`, `type: "local"`, command `npx @playwright/mcp@latest`, `enabled: true`). opencode spawns it automatically — there is no manual start step.

---

## What you can do

The MCP server exposes `browser_*` tools; depending on the harness they may appear namespaced as `playwright_browser_*` (e.g. `playwright_browser_navigate`). The common ones:

| Tool                       | What it does                                               |
| -------------------------- | ---------------------------------------------------------- |
| `browser_navigate`         | Go to a URL                                                |
| `browser_take_screenshot`  | Capture the current page (viewport or full page)           |
| `browser_snapshot`         | Accessibility snapshot — prefer this to find elements/refs |
| `browser_click`            | Click an element by ref/selector                           |
| `browser_type`             | Type into an input                                         |
| `browser_fill_form`        | Fill multiple fields at once                               |
| `browser_select_option`    | Choose a dropdown option                                   |
| `browser_hover`            | Hover over an element                                      |
| `browser_press_key`        | Send a key                                                 |
| `browser_evaluate`         | Run arbitrary JS in the page context                       |
| `browser_wait_for`         | Wait for text to appear/disappear or a delay               |
| `browser_resize`           | Resize the viewport                                        |
| `browser_console_messages` | Read console output                                        |
| `browser_network_requests` | Inspect network traffic                                    |
| `browser_navigate_back`    | Go back in history                                         |

Typical usage:

```
Use browser_navigate to go to http://localhost:5173/albums
Use browser_take_screenshot to capture the page
Use browser_click on the element with ref "e12" (found via browser_snapshot)
```

Prefer refs from `browser_snapshot` (or `browser_find` for text) over CSS selectors — they're stable and match the accessible labels the i18n system renders.

---

## Workflow: verifying a frontend change

After making changes to a component or page:

1. Confirm `pnpm frontend:dev` is running (check that port 5173 responds)
2. `browser_navigate` to the affected route
3. `browser_take_screenshot` and inspect the layout, labels and states
4. If something looks wrong, read `browser_console_messages` (level `warning`/`error`) and `browser_network_requests` for failed fetches
5. For responsive checks, repeat with `browser_resize` at 375/768/1280 and check `document.documentElement.scrollWidth > document.documentElement.clientWidth` via `browser_evaluate`
6. Report findings to the user with the screenshot

---

## Workflow: verifying i18n

After adding translation keys:

1. Navigate to the affected page and take a screenshot
2. Look for raw translation keys rendered as text (e.g. `player.title` instead of the label) — these indicate missing or mismatched keys
3. Switch language by setting the app's real key and reloading:
   ```js
   localStorage.setItem("language", "es"); // NOT "i18nextLng"
   location.reload();
   ```
   (The app also exposes the switch in Settings → Appearance.)
4. Check **EN, ES and IT** — all three locales must have the key; a missing key silently falls back to English

---

## Workflow: verifying a new route's proxy

After adding a new backend route + Vite proxy entry:

1. Navigate to a page that calls the new endpoint
2. Use `browser_network_requests` (filtered on the new path) to confirm the request went to the backend and got a 2xx
3. A 404 on the API call usually means the Vite proxy entry is missing — add it to `packages/frontend/vite.config.ts`

---

## Setup reference

The server entry in `/workspace/opencode.json`:

```json
"mcp": {
  "playwright": {
    "type": "local",
    "command": ["npx", "@playwright/mcp@latest", "--no-sandbox"],
    "enabled": true
  }
}
```

`--no-sandbox` is required because the dev container runs as root (Chromium refuses to sandbox as root). The `@playwright/mcp` package launches headless Chromium on demand — no separate install needed; if Chrome is missing, run `npx playwright install chrome`. On first run it may download the browser binary (~150MB). For a visible browser while debugging a new interaction, append `"--headed"` to the `command` array.

---

## Tips

- Take a screenshot first, then act — don't assume the page is in the state you expect.
- Prefer `browser_snapshot`/`browser_find` refs over CSS selectors: the Sonect frontend labels everything through `t("key")`, so rendered text matches the English translation.
- If the page shows a blank screen, the Vite dev server may not be running or there's a JS error — check `browser_console_messages` and `document.querySelector('#root')?.innerHTML` via `browser_evaluate`.
- Tailwind CSS 4 class names are generated at build time; don't rely on class selectors in assertions.
