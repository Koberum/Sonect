---
name: sonect-playwright
description: Use Playwright to visually verify, test, or debug the Sonect frontend UI. Use this skill whenever the user asks to check what the UI looks like, verify a frontend change rendered correctly, take a screenshot of a page or component, click through a user flow to confirm it works, or write end-to-end tests. This skill requires the Playwright MCP server to be running — see setup below. Trigger whenever the user wants to see the frontend, confirm visual output, or validate a UI interaction.
---

# Sonect Playwright — Frontend Visibility

The Playwright MCP server gives the agent eyes: it can navigate to the Vite dev server, take screenshots, click elements, fill inputs, and verify what actually rendered.

## Prerequisites

The frontend dev server must be running:
```bash
pnpm frontend:dev   # starts on http://localhost:5173
```

The Playwright MCP server must be configured in `opencode.jsonc` (see Setup below).

---

## What you can do

### Take a screenshot to see the current state

```
Use the playwright_screenshot tool to capture http://localhost:5173
```

Always take a screenshot **after** making frontend changes to confirm the result before telling the user it's done.

### Navigate to a specific page

```
Use playwright_navigate to go to http://localhost:5173/library
```

### Click a button or element

```
Use playwright_click with selector "button[aria-label='Play']"
```

Prefer `aria-label`, `role`, and `data-testid` selectors over CSS class selectors — they're more stable and match how the i18n system labels things.

### Fill an input

```
Use playwright_fill with selector "input[placeholder]" and value "Radiohead"
```

### Get page content / check text

```
Use playwright_evaluate to run document.body.innerText and check for expected strings
```

---

## Workflow: verifying a frontend change

After making changes to a component or page:

1. Confirm `pnpm frontend:dev` is running (check if port 5173 responds)
2. Take a screenshot with `playwright_screenshot`
3. Inspect the screenshot — does the layout look right? Are labels correct? Is the component visible?
4. If something looks wrong, check the browser console with `playwright_evaluate`: `console.log` is not available in prod paths but errors will show up via `window.__errors` or by checking network tab equivalents
5. Navigate to the specific route if needed
6. Report findings to the user with the screenshot

---

## Workflow: verifying i18n

After adding translation keys:

1. Navigate to the affected page
2. Take a screenshot
3. Look for any raw translation keys rendered as text (e.g. `player.controls.play` instead of `Play`) — these indicate missing or mismatched keys
4. Check both EN and ES by toggling language if the app has a language switcher, or by evaluating `localStorage.setItem('i18nextLng', 'es')` and reloading

---

## Workflow: verifying a new route's proxy

After adding a new backend route + Vite proxy entry:

1. Navigate to a page that calls the new endpoint
2. Use `playwright_evaluate` to check for network errors:
   ```js
   // Run in browser context
   performance.getEntriesByType('resource').filter(r => r.name.includes('/your-new-route'))
   ```
3. Or open the network panel equivalent by checking `playwright_evaluate` for failed fetches
4. A 404 on the API call usually means the Vite proxy entry is missing — go add it to `vite.config.ts`

---

## Setup

Add this to your `opencode.jsonc` under `mcpServers`:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"]
    }
  }
}
```

The `@playwright/mcp` package runs a headless Chromium browser on demand — no separate install needed. On first run it may download the browser binary (~150MB).

If you want a visible browser window for debugging (useful when building new interactions):

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--headed"]
    }
  }
}
```

---

## Available Playwright MCP tools (reference)

| Tool | What it does |
|------|-------------|
| `playwright_navigate` | Go to a URL |
| `playwright_screenshot` | Capture the current page as an image |
| `playwright_click` | Click an element by selector |
| `playwright_fill` | Type into an input |
| `playwright_select` | Choose a dropdown option |
| `playwright_hover` | Hover over an element |
| `playwright_evaluate` | Run arbitrary JS in the browser context |
| `playwright_wait_for_selector` | Wait for an element to appear |
| `playwright_go_back` / `playwright_go_forward` | Browser navigation |

---

## Tips

- Take a screenshot first, then act — don't assume the page is in the state you expect.
- When clicking, prefer `aria-label` over CSS selectors. The Sonect frontend uses `t("key")` for all labels, so the rendered text matches the English translation.
- If the page shows a blank white screen, the Vite dev server may not be running or there's a JS error — check with `playwright_evaluate`: `document.querySelector('#root')?.innerHTML`.
- Tailwind CSS 4 class names are generated at build time; don't rely on class selectors in assertions.
