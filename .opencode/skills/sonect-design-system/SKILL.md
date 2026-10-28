---
name: sonect-design-system
description: Enforce Sonect's design system whenever touching any UI in packages/frontend/src/. Defines the semantic tokens, icon scale, row-action pattern, loading/empty states, spacing rhythm, radius rules, heading hierarchy, and the shared components (EmptyState, PageHeader, LibraryStats). Trigger whenever creating or modifying any component, page, or style in the frontend.
---

# Sonect Design System

Sonect uses **Tailwind CSS 4** + **shadcn/ui**. These rules are binding for every
UI change. They exist because the interface drifted: five icon sizes, three
loading patterns, five empty-state variants, and hardcoded colors. Do not
reintroduce per-page inventions.

---

## Tokens (colors)

All colors come from semantic tokens defined in `packages/frontend/src/index.css`
(`:root`, `.dark`, `@theme inline`). Use Tailwind utilities built from them.

| Token                 | Utility example                      | Use                           |
| --------------------- | ------------------------------------ | ----------------------------- |
| `--primary`           | `bg-primary text-primary-foreground` | Brand orange, primary actions |
| `--secondary`         | `bg-secondary`                       | Neutral secondary surfaces    |
| `--muted`             | `text-muted-foreground`              | Secondary text, hints         |
| `--destructive`       | `text-destructive`, `bg-destructive` | Errors, delete actions        |
| `--success`           | `text-success`                       | Online/OK status indicators   |
| `--warning`           | `text-warning`                       | Degraded/warning status       |
| `--card` / `--border` | `bg-card`, `border-border`           | Containers                    |

Rules:

- **Never** use palette literals (`text-white`, `text-red-500`, `bg-black/50`, hex
  values, `from-blue-500…`). If a color is missing, add a token to both `:root`
  and `.dark` and expose it in `@theme inline`.
- **Only documented exceptions:**
  1. Overlay scrims (`bg-black/40|50|80` in `Dialog`/`Sheet`/`AlertDialog`/player
     overlays) — they dim, they are not theme colors.
  2. Avatar initials rendered on dynamic per-profile colors
     (`text-white` inside a circle whose background comes from data).
- Destructive surfaces use `text-destructive-foreground`, never `text-white`.

---

## Icon scale (lucide-react)

Exactly three sizes:

| Size     | Where                                                          |
| -------- | -------------------------------------------------------------- |
| `size-4` | Inside buttons, rows, table cells, inline with `text-sm` text  |
| `size-5` | Player/header hero controls (play/pause/next, top-bar actions) |
| `size-8` | Empty states and other large illustrative spots                |

- No standalone `h-3` / `h-3.5` (12–14 px) icons. Button internals already get
  `size-4` from `button.tsx` when the icon has no explicit size class — don't
  override unless the button is a player control.
- Avatar initials (`text-[10px]` inside small colored circles) are the only
  allowed tiny-text exception.

---

## Row actions

Every row-level action button (add to queue, remove, refresh stats, edit,
delete, queue controls) uses:

```tsx
<Button variant="bare" size="icon-sm" aria-label={t(...)} disabled={pending}>
  <Icon />
</Button>
```

- **Icon-only buttons use `variant="bare"`** — no background or border at rest,
  and no hover background. Only the icon changes color/opacity on hover
  (`text-muted-foreground` → `text-foreground`, or an active/destructive color).
  Text buttons keep `ghost` (which still highlights its surface).
- `size="icon-sm"` — never `icon-xs` in one page and `icon-sm` in another.
- `aria-label` is mandatory for icon-only buttons; add a `Tooltip` when the icon
  is not self-evident.
- Disable **only** the row whose mutation is pending (`mutation.isPending &&
mutation.variables === id`).
- Hover-reveal pattern (row actions that appear on hover) uses exactly:
  `opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100`
  — no `hover:!opacity-100` hacks.
- Primary inline actions inside rows use `size="sm"` (e.g. "Add" on a detected
  folder).

---

## Loading and empty states

- **Lists, grids, cards** → `Skeleton` placeholders (e.g. 3 ×
  `h-16 rounded-lg` for rows). No centered border spinners, no page-blocking
  spinners.
- **Buttons** → `Loader2` with `animate-spin` inside the button, and the button
  disabled while pending.
- **Every list/grid gets an empty state** via the shared `EmptyState` component
  (icon `size-8`, title, optional description, optional action). No bare
  `<p className="text-center">` one-liners.
- **Queries with an error state** render an inline destructive-tinted alert with
  a Retry action — never a silent empty list.

---

## Spacing rhythm

- Page container: `px-4 py-6 lg:px-8` (owned by `MainLayout`; pages don't add
  their own horizontal padding).
- Between top-level sections of a page: `space-y-6`.
- Grids: always `gap-4`.
- Rows/cards content: `p-3` inside `rounded-lg border` interactive rows.
- `PageHeader` already owns the `mb-6` below the title; never add extra
  top-margin to the first content block.
- Sort/filter toolbars: `mb-4`, consistently. Subtitles: no floating margins.

## Radius

- `rounded-xl` — Cards and page-level containers.
- `rounded-lg` — interactive rows, list items, inner panels.
- `rounded-md` — inner elements: artwork thumbnails, inputs, buttons (as shipped
  by shadcn).
- Fully round (`rounded-full`) only for avatars/pills.

## Headings

- One `<h1>` per page, rendered by `PageHeader` (`text-2xl font-semibold`).
- Section titles inside a page: `<h2>` (`text-sm uppercase tracking-wider
text-muted-foreground` for dashboard-style sections).
- Never ship two different heading sizes for the same structural level on
  different pages.

---

## Shared components catalog

| Component      | Location                              | Contract                                                                                                                |
| -------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `EmptyState`   | `components/ui/empty-state.tsx`       | `{ icon: LucideIcon; title: string; description?: string; action?: ReactNode }`                                         |
| `PageHeader`   | `components/ui/page-header.tsx`       | `{ title: ReactNode; description?: ReactNode; actions?: ReactNode; media?: ReactNode }` — page `h1` left, optional media beside it, action buttons right             |
| `LibraryStats` | `features/settings/library-stats.tsx` | `{ stats?: { file_count?: number; dir_count?: number; total_size?: number } \| null }` — "N files · N folders · 1.2 GB" |

Button usage map:

| Situation                       | Button                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------- |
| Primary page/card action        | `default` (optionally `size="sm"` inline)                                                         |
| Secondary action, Cancel        | `outline`                                                                                         |
| Row-level icon action           | `bare size="icon-sm"`                                                                             |
| Table/queue inline icon actions | `bare size="icon-sm"`                                                                             |
| Dangerous confirm               | `variant="destructive"` (in `AlertDialogAction` use `buttonVariants({ variant: "destructive" })`) |
| Text-only tertiary              | `link` or `ghost` with label                                                                      |

Footer order everywhere: secondary/outline (Cancel/Back) **left**, primary
action **right**. Destructive confirm dialogs: Cancel left, destructive right.

---

## i18n

Every user-visible string (label, placeholder, `aria-label`, tooltip, toast,
empty state) goes through `t("key.path")` and exists in **en.json, es.json,
it.json**. No hardcoded English in components, including validation messages.

---

## Checklist (every UI change)

- [ ] Only semantic tokens (no palette literals except the two exceptions)
- [ ] Icons are `size-4` / `size-5` / `size-8` per the scale
- [ ] Icon-only actions are `bare icon-sm` with `aria-label` (no hover background)
- [ ] Loading uses Skeleton (lists) or in-button Loader2
- [ ] Empty state uses `EmptyState`; error state offers Retry
- [ ] Spacing follows the rhythm (`gap-4`, `space-y-6`, rows `p-3`)
- [ ] Radius follows the mapping
- [ ] One `h1` per page via `PageHeader`
- [ ] All strings in en/es/it
- [ ] Playwright check at 375 / 768 / 1280 px (see `sonect-responsive`)
