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
└── es.json
```

Both files must be updated together. Never ship a key in `en.json` without the corresponding key in `es.json`.

---

## Basic usage in components

```tsx
import { useTranslation } from "react-i18next";

export function VolumeControl() {
  const { t } = useTranslation("player");

  return (
    <div>
      <label>{t("volume.label")}</label>
      <input
        type="range"
        aria-label={t("volume.ariaLabel")}
        placeholder={t("volume.placeholder")}
      />
      <button aria-label={t("volume.muteAriaLabel")}>
        {t("volume.mute")}
      </button>
    </div>
  );
}
```

---

## Namespace conventions

Namespaces map to features/pages. Use the feature name as the namespace:

| Namespace | Covers |
|-----------|--------|
| `player` | Music player controls, playback status |
| `library` | Track list, albums, artists, search |
| `playlists` | Playlist management |
| `settings` | App settings |
| `common` | Shared: errors, loading states, buttons like "Cancel", "Save" |
| `nav` | Navigation menu items |

When creating a new feature, create a new namespace (or use `common` for truly generic text).

---

## Key structure

Use dot-notation to group related keys. Keep it readable — the key should describe what it is, not where it is:

```json
// en.json (partial)
{
  "player": {
    "controls": {
      "play": "Play",
      "pause": "Pause",
      "next": "Next track",
      "previous": "Previous track",
      "shuffleAriaLabel": "Toggle shuffle"
    },
    "volume": {
      "label": "Volume",
      "muteAriaLabel": "Mute",
      "unmuteAriaLabel": "Unmute"
    },
    "status": {
      "playing": "Now playing",
      "paused": "Paused",
      "stopped": "Stopped",
      "noTrack": "No track selected"
    }
  }
}
```

Avoid deeply nesting beyond 3 levels — it becomes hard to maintain.

---

## Interpolation for dynamic values

```tsx
// Key: "library.trackCount": "{{count}} tracks"
t("library.trackCount", { count: tracks.length })

// Key: "player.nowPlaying": "Now playing: {{title}} by {{artist}}"
t("player.nowPlaying", { title: track.title, artist: track.artist })
```

---

## Pluralization

```json
"library.trackCount_one": "{{count}} track",
"library.trackCount_other": "{{count}} tracks"
```

```tsx
t("library.trackCount", { count: n }) // auto-selects _one or _other
```

---

## Toast messages

Toast messages are user-visible and must also be translated:

```tsx
import { useTranslation } from "react-i18next";
import { toast } from "...; // whatever toast lib is in use

const { t } = useTranslation("common");

// On error:
toast.error(t("common.errors.loadFailed"));

// On success:
toast.success(t("common.success.saved"));
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

After writing the component, grep for hardcoded strings as a sanity check:
```bash
grep -n '"[A-Z][a-z]' packages/frontend/src/components/YourComponent.tsx
grep -n "'[A-Z][a-z]" packages/frontend/src/components/YourComponent.tsx
```

---

## Both locale files must be in sync

When adding keys to `en.json`, always add the Spanish equivalent to `es.json` in the same operation. If you don't know the Spanish translation, use the English value as a placeholder and add a `// TODO: translate` comment in a review note — but the key must exist.

Wrong: add key to `en.json`, skip `es.json`  
Right: add key to both files in the same edit
