---
name: sonect-i18n
description: Add, fix, or audit internationalization (i18n) in the Sonect frontend. Use this skill whenever building a new component, page, or feature that has any user-visible text, when fixing hardcoded strings, when adding new translation keys, or when reviewing i18n coverage. Every label, button, heading, placeholder, aria-label, toast, and alt text must use t() — this skill enforces that rule and guides correct key placement. Trigger whenever you touch files in packages/frontend/src/ and there is any user-visible text involved.
---

# Sonect i18n

Sonect uses `i18next` + `react-i18next`. Every user-visible string must go through the translation system — no exceptions.

Translation files live at:

```
packages/frontend/src/i18n/locales/
├── en.json
├── es.json
└── it.json
```

All three files must be updated together. Never ship a key in `en.json` without the corresponding key in `es.json` and `it.json`.

---

## Basic usage in components

The app configures i18next with **no custom namespaces** — every call is a plain `useTranslation()` and keys are read from the default namespace (the top-level groups in the JSON files):

```tsx
import { useTranslation } from "react-i18next";

export function OutputSelector() {
  const { t } = useTranslation(); // no namespace argument

  return (
    <div>
      <p>{t("player.title")}</p>
      <button aria-label={t("player.outputDevices")}>
        {t("player.thisDevice")}
      </button>
    </div>
  );
}
```

Do not pass a namespace to `useTranslation()` — none are configured.

---

## Key groups

Keys are grouped by feature/page in the JSON root. Use the existing group that matches the feature:

| Group                                              | Covers                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| `player`                                           | Music player controls, playback status, output devices           |
| `queue`                                            | Queue view                                                       |
| `sidebar`, `albums`, `tracks`, `artists`, `genres` | Library browsing                                                 |
| `playlist` / `playlists`                           | Playlist management                                              |
| `settings`                                         | App settings (nested: `settings.libraries`, `settings.debug`, …) |
| `common`                                           | Shared: loading, cancel, close, saving, …                        |
| `setup`                                            | First-run wizard                                                 |

When adding a feature, add a new top-level group (or reuse `common` for truly generic text).

---

## Key structure

Use dot-notation to group related keys. Keep it readable — the key should describe what it is, not where it is:

```json
// en.json (new group for a hypothetical feature)
{
  "radiostations": {
    "title": "Radio Stations",
    "empty": "No stations configured",
    "add": {
      "label": "Add station",
      "placeholder": "Stream URL"
    }
  }
}
```

Avoid deeply nesting beyond 3 levels — it becomes hard to maintain.

---

## Interpolation for dynamic values

```tsx
// Key: "genres.albumCount_one/_other": "{{count}} album(s)" (plural variants below)
t("genres.albumCount", { count: albums.length });

// Key: "statistics.percentOfLibrary": "{{percent}}% of library"
t("statistics.percentOfLibrary", { percent: share });
```

---

## Pluralization

Use the i18next v4 suffixes `_one` / `_other` (NOT the legacy `_plural` suffix). Real example from `queue.tracksInQueue`:

```json
"queue": {
  "tracksInQueue_one": "{{count}} track in queue",
  "tracksInQueue_other": "{{count}} tracks in queue"
}
```

```tsx
t("queue.tracksInQueue", { count: queue.length }); // auto-selects _one or _other
```

---

## Toast messages

The project uses `sonner`. Toast text is user-visible and must be translated:

```tsx
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const { t } = useTranslation();

// On error:
toast.error(t("settings.libraries.deleteError"));

// On success:
toast.success(t("settings.libraries.created"));
```

---

## Checklist when building a new component

Go through every string that will appear in the UI:

- [ ] Button labels → `t()`
- [ ] Headings and body text → `t()`
- [ ] Input placeholders → `t()`
- [ ] `aria-label` attributes → `t()`
- [ ] `alt` text on images → `t()`
- [ ] Toast / notification messages → `t()`
- [ ] Error messages shown to the user → `t()`
- [ ] Empty state messages ("No tracks found") → `t()`
- [ ] Tooltip content → `t()`

After writing the component, check that every key you added exists in all three locale files:

```bash
grep -n '"[A-Z][a-z]' packages/frontend/src/components/YourComponent.tsx
grep -n "'[A-Z][a-z]" packages/frontend/src/components/YourComponent.tsx
```

A key referenced via `t("...")` but missing from a locale silently falls back to English at runtime — grep the new keys in `en.json`, `es.json` and `it.json` before finishing.

---

## All locale files must be in sync

When adding keys to `en.json`, always add the Spanish and Italian equivalents in the same operation. If you don't know a translation, use the English value as a placeholder — but the key must exist in every file.

Wrong: add key to `en.json`, skip `es.json`/`it.json`  
Right: add the key to all three files in the same edit
