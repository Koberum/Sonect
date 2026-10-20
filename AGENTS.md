# Sonect – Agent Instructions

This file provides instructions for AI coding agents working in this repository.

## Project overview

Sonect is a self-hosted music streaming application. A Node.js/Express backend communicates with Music Player Daemon (MPD) and exposes a REST + WebSocket API consumed by a React frontend. The whole repo is a **pnpm monorepo**.

## Workspace packages

| Package       | Path                | Purpose                                            |
| ------------- | ------------------- | -------------------------------------------------- |
| `backend`     | `packages/backend`  | Express 5 HTTP + WebSocket server                  |
| `frontend`    | `packages/frontend` | React 19 + Vite SPA                                |
| `@repo/db`    | `packages/db`       | Native SQLite (node:sqlite) + Drizzle repositories |
| `@repo/types` | `packages/types`    | Shared TypeScript types + zod validation schemas   |

## Commands

```bash
pnpm install            # Install all dependencies
pnpm dev                # Development (all packages in parallel)
pnpm build              # Compile all packages with tsc
pnpm lint               # Lint all packages with ESLint
pnpm frontend:dev       # Frontend dev server on :5173
pnpm backend:dev        # Backend dev server on :3000
pnpm backend:bundle     # Bundle backend with esbuild → dist/bundle.cjs
pnpm backend:start      # Start production build (node dist/bundle.cjs)
pnpm backend:test       # Run backend tests (Mocha/Chai/Sinon/Supertest)
pnpm backend:test:watch # Backend tests in watch mode
pnpm backend:test:coverage # Backend test coverage report (c8)
pnpm db:generate        # Generate a new SQL migration from tables.ts (drizzle-kit)
pnpm db:migrate         # Apply pending migrations to DB_PATH (dev convenience)
pnpm db:migrate-reset   # Wipe + re-apply migrations; prompts, --force skips
pnpm db:studio          # drizzle-kit studio browser GUI
pnpm clean              # Remove node_modules and dist from all packages
```

### Turborepo

The monorepo is orchestrated by **Turborepo** (`turbo.json` at the repo root,
`turbo` as a root devDependency). `build`, `lint`, and `test` are turbo tasks;
`dev` is a root pnpm script that first runs `turbo run build --filter @repo/db
--filter @repo/types` and then starts every package's watch process via
`concurrently`:

- `build` and `lint` are **cached**: re-running them without source
  changes is near-instant (`>>> FULL TURBO`); after an edit only the touched
  package and its dependents rebuild. Cached outputs include `dist/**` and the
  frontend `node_modules/.tmp/**` tsbuildinfo files. `test` runs fresh on every
  invocation (`cache: false`) so a changed environment can never be masked by
  a replayed result.
- The frontend `build` task declares `env: ["VITE_BACKEND_URL",
"VITE_WEBSOCKET_URL", "VITE_COVER_PATH", "VITE_DEBUG"]` — if you add a new
  `VITE_*` env var read by frontend code, add it to that list or stale cached
  builds will be served.
- Turbo cache lives in `.turbo/` (gitignored). CI restores it with
  `actions/cache` (`.github/workflows/ci.yml`); a remote cache is not wired up.

### Verification steps

After making changes:

1. `pnpm lint` — must pass with zero errors
2. `pnpm build` — must compile with zero errors (strict TypeScript)
3. `pnpm backend:test` — must pass (backend only has tests currently)

## Environment variables (packages/backend/.env)

| Variable           | Default                                                         | Purpose                                                                                                        |
| ------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `MPD_HOST`         | `localhost`                                                     | MPD daemon hostname                                                                                            |
| `MPD_PORT`         | `6600`                                                          | MPD daemon port                                                                                                |
| `COVERS_DIR`       | `./data/covers`                                                 | Path where cover WebPs are saved                                                                               |
| `COVER_SIZE`       | `400`                                                           | Cover resize dimension (px, square fit inside)                                                                 |
| `COVER_QUALITY`    | `80`                                                            | WebP quality for covers                                                                                        |
| `MUSIC_DIR`        | `/opt/sonect/music` (code default; `/libraries` in docker)      | Root directory of the music library                                                                            |
| `MUSIC_EXTENSIONS` | `mp3,flac,ogg,oga,opus,m4a,aac,wav,wma,ape,wv,dsf,dff,mpc,tta`  | Audio extensions counted as music files in per-source library stats                                            |
| `PORT`             | `3000`                                                          | Backend HTTP server port                                                                                       |
| `FRONTEND_DIST`    | `@frontend/dist` (cwd-relative; `/app/frontend/dist` in docker) | Path to built frontend static files (prod)                                                                     |
| `WAVEFORMS_DIR`    | `<COVERS_DIR>/../waveforms` or `./data/waveforms`               | Path where waveform JSON caches are saved (SHA1(file).json)                                                    |
| `LOG_LEVEL`        | `info`                                                          | Console log level (`debug`/`info`/`warn`/`error`); `debug` logs every found/updated/removed track during scans |
| `MPD_LOG_PATH`     | —                                                               | MPD log file; no longer read by Sonect (sync progress comes from the scanner)                                  |
| `DNS_CHECK_HOST`   | `example.com`                                                   | Host resolved to verify DNS connectivity                                                                       |

## Production deployment (Docker)

Sonect ships as a **single container image**, `ghcr.io/koberum/sonect`, bundling
MPD (Music Player Daemon) and the Node backend (API + WebSocket + built SPA on
port 3000) under **s6-overlay**, which supervises both as longruns
(`mpd` and `node`). There is no systemd/native installer — Docker is the only
production path. `docker/docker-compose.yml` defines the one `sonect` service
and includes audio access by default (live `/dev/snd` bind mount + ALSA device
cgroup rule); there is no separate audio overlay.

```
sonect (single image, ENTRYPOINT /init)
  s6-overlay supervises:
    mpd  longrun → mpd --no-daemon /etc/mpd/mpd.conf (music_directory /libraries)
    node longrun → node /app/bundle.cjs (API + WS + SPA)
  env: MPD_HOST=127.0.0.1, MPD_PORT=6600, MUSIC_DIR=/libraries, PORT=3000
  volumes: libraries(ro), sonect-data(rw, mounted at /app/data)
  audio access (built into docker-compose.yml): /dev/snd bind mount (live),
      device_cgroup_rules(c 116:* rwm), group_add(audio)
      (NO privileged: true, no /proc/asound mount)
```

- ` /player` is the single playback API (requires `X-Session-Id`). Legacy `/mpd`
  routes were removed; `/session` remains only for legacy backend tests.
- **Storage is host-provided.** Music folders are bind-mounted into the single
  container under `/libraries/<name>`. The backend never mounts anything and
  never runs privileged commands; a library source is just a registered path
  under `MUSIC_DIR` (which is MPD's one `music_directory`). SMB/NFS are mounted
  by the host (fstab) and bind-mounted in. There is **no shared compose network,
  no separate MPD config/log/state volumes** — MPD lives
  in the same container, reaching the backend over `127.0.0.1:6600`, and all
  persistent state (DB, covers, waveforms, MPD drop-in, MPD tag cache) lives
  under `/app/data`.
- **MPD is reloaded by the backend, not a watcher.** After the backend writes
  the drop-in it invokes its injectable reload hook: under s6 it runs
  `s6-svc -r /run/service/mpd`; in dev (no s6) it falls back to `SIGHUP`
  (`pkill -HUP mpd`). There is no `inotifywait` watcher and no separate MPD
  entrypoint.
- **Audio devices** are enumerated from `/sys/class/sound`
  (`systemService.detectAudioDevices`): playback PCMs are `pcmC<N>D<M>p`, the
  card id comes from `card<N>/id`, and USB metadata is resolved from
  `card<N>/device` (`uevent`, then parent/resolved `idVendor`/`idProduct`/
  `manufacturer`/`product`). `/proc/asound` is only an enrichment and fallback
  for bare metal or unusual environments. Device IDs are stable
  `hw:CARD=<id>,DEV=<n>`, so card-index changes across reboots/hotplug do not
  break playback; a numeric `hw:<index>,<dev>` is used only when no usable card
  id exists. Containers therefore need the live `/dev/snd` bind mount and
  `device_cgroup_rules: c 116:* rwm` from `docker/docker-compose.yml` — not a
  `/proc/asound` mount.

### Build pipeline

- **Backend**: `pnpm backend:bundle` uses esbuild to bundle all JS code (Express,
  Zod, ws, music-metadata, workspace deps) into `dist/bundle.cjs`. Only `sharp`
  and `dotenv` remain external as runtime dependencies. The bundle defines
  `SONECT_BUNDLE_URL` via `--banner:js` and rewrites **all** `import.meta.url`
  occurrences via `--define:import.meta.url=SONECT_BUNDLE_URL` (currently only the
  `@repo/db` migrator uses it, to locate `dist/drizzle/`), then copies
  `../db/drizzle` to `dist/drizzle`. **Hazard:** if a future bundled dependency
  relies on `import.meta.url` for its own file's URL, it will silently receive the
  migrations-anchor URL instead.
  At runtime `bundle.cjs` lives in `/app`, so the anchor resolves
  `MIGRATIONS_FOLDER` to **`/app/drizzle/`** — the Dockerfile **must** copy
  `dist/drizzle` there (`COPY --from=builder .../dist/drizzle ./drizzle`).
  Removing that line makes the app crash at startup with
  `ENOENT: ... scandir '/app/drizzle/'`.
- **Frontend**: `pnpm frontend:build` runs Vite, outputs static files to
  `frontend/dist/`.
- **App image** (`packages/backend/Dockerfile`, build context = repo root) bundles
  the backend + built frontend, installs `mpd` (the daemon it now supervises),
  `ffmpeg` (waveforms), `alsa-utils`, plus **s6-overlay** (v3, arch-selected from
  `TARGETARCH`), keeps only `sharp`/`dotenv` as runtime deps, copies the baked
  base `docker/mpd.conf` to `/etc/mpd/mpd.conf` and the `docker/s6/s6-rc.d`
  service tree, stamps `/app/.version`, and runs `ENTRYPOINT ["/init"]` with an
  empty `CMD` so s6 — not a stray CMD — owns the container. The `/app/drizzle`
  COPY **must remain** (see the migrator anchor note above).
- **Release CI**: release-please
  (`release-please-config.json` + `.release-please-manifest.json`) owns the
  version/CHANGELOG/release on `main`. `.github/workflows/docker.yml` builds the
  **multi-arch** (`linux/amd64`, `linux/arm64`) `sonect` image and pushes it to
  GHCR as `ghcr.io/<owner>/sonect` (tags `latest` + version). It is invoked two
  ways: on PRs it builds but does **not** push; on a release, `release.yml` calls
  it as a **reusable workflow**
  (`workflow_call`, passing the `version`) right after release-please. The
  release event is not used because a release created with the default
  `GITHUB_TOKEN` does not trigger other workflows (`release: published` would
  never fire) — the build runs in the same run that creates the release. The
  workflow is also `workflow_dispatch`-able with a `version` input to
  (re)publish images for an existing release.
- **Version**: the running version comes from `/app/.version` written into the
  app image by the release build (Docker `SONECT_VERSION` build-arg, leading
  `v` stripped) and is exposed via `GET /system/status` → `version`
  (fallback `"dev"` when absent).
- **Startup**: `node bundle.cjs` — no tsx, no vite, no compilation at runtime.

## Key conventions

### TypeScript

- Strict mode is enabled across all packages.
- All packages use ESM (`"type": "module"`).
- Use `tsx` for running TypeScript in development; compile with `tsc` for production.
- Cross-package imports use workspace aliases: `@repo/db`, `@repo/types`, etc.
- React components use `.tsx` extension; everything else uses `.ts`.
- **TypeScript version:** 7.0.2. The project uses the native Go-based TS 7 compiler for all
  builds (`tsc` binary = TypeScript 7.0.2). However, TypeScript 7.0 ships with no JavaScript
  programmatic API, which breaks `typescript-eslint`. The frontend uses a **two-version
  side-by-side setup** to work around this:
  - `"@typescript/native": "npm:typescript@7.0.2"` — provides the `tsc` binary (TS 7)
  - `"typescript": "npm:@typescript/typescript6@6.0.2"` — provides the TS 6 JS API that
    `typescript-eslint` imports at runtime
  - All four packages (`backend`, `frontend`, `db`, `types`) use this two-alias setup
    and keep `typescript-eslint` as a devDependency.
  - This setup is temporary. When typescript-eslint gains native TS 7 support (blocked on TS
    7.1 shipping a new programmatic API), remove both aliases from every package's
    `package.json` and restore `"typescript": "npm:typescript@^7.x"`.

### Backend

- Routes live in `packages/backend/src/routes/`.
- Business logic lives in `packages/backend/src/services/`.
- WebSocket handlers live in `packages/backend/src/ws/`.
- Controllers (input validation / response shaping) live in `packages/backend/src/controllers/`.
- **MpdConnectionManager** (`services/mpd/mpdConnectionManager.ts`) is a singleton that manages **two** TCP connections to MPD: a command client (`cmdClient`) and a polling client (`pollSocket`). The **cmdClient** uses the `mpd` npm package (v1.3.0) for command execution. The **pollSocket** uses raw TCP (`net` module) to send `status` commands directly — this avoids the `mpd` package's `idle`-based callback queue which caused silent polling failures. Polling happens on a timer: every 2s during `play`, every 10s during `pause`/`stop`. The in-memory `PlaybackStatus` cache is maintained and `stateChanged` events are emitted to subscribers on each poll. A `refreshNow()` method is also exposed for immediate cache refresh after user-initiated commands. When MPD disconnects, each connection auto-reconnects with exponential backoff (1s–30s).
- `playerService.ts` reads the cached status synchronously via `mpdConnectionManager.getCachedStatus()`. It delegates commands to `mpdConnectionManager.executeCommand()` / `executeCommandList()` and fires `mpdConnectionManager.refreshNow()` (fire-and-forget with `.catch`) after each command for prompt feedback; if a poll is already in flight the refresh is skipped and the next tick applies. Note: `getQueue()` is an exception — it runs an async MPD query (`playlistinfo`).
- `player.ws.ts` sends the cached status to new WebSocket clients immediately on connect (wrapped in `{ type: "player-status", ... }` envelope), then forwards subsequent `stateChanged` events from the polling loop. All WS messages follow a standard format with a `type` field: `"player-status"`, `"sync-progress"`, `"sync-complete"`, `"sync-error"`, or `"log"`.
- The `mpd` npm package (v1.3.0) is bundled into the backend output; it is only used for the `cmdClient`. The `pollSocket` uses raw TCP to avoid idle-protocol callback desync.
- Use `process.env` variables for configuration; never hard-code hosts, ports, or paths.
- **Zod validation** is applied directly in controller functions via `schema.parse(req.body)` / `schema.parse(req.params)`. Schemas are defined in `@repo/types` (`packages/types/src/schemas/types.ts`, re-exported from `packages/types/src/schemas/index.ts`). `ZodError` propagates to `errorHandler` which returns a 400 response with `flatten().fieldErrors` under `details`.
- **asyncHandler** (`middleware/asyncHandler.ts`) wraps all async controllers; it **returns the promise chain** so tests can `await` it.
- **errorHandler** (`middleware/errorHandler.ts`) is registered in `app.ts` as the last middleware. Controllers throw `NotFoundError`/`ValidationError` for centralized handling.
- **autoplayService** (`services/mpd/autoplayService.ts`) is always active for both MPD and browser sessions. A manual track selection queues that track through the end of its album, without wrapping to earlier tracks. Smart batches then add complete albums in this order: same artist → same genre → similar genres → (genre-less only) library-wide, ranking each tier by the sum of its tracks' `play_count` (title order breaks ties). Similar genres are resolved via `services/mpd/genreSimilarity.ts`: a curated map for common tags (e.g. `techno → tech house, minimal, house…`) with token/substring fallback for arbitrary MPD `Genre` tags (`Vaporwave → Vapor House` via `genresDb.getAll()` substring match). Ranking stays anchored to the manually selected track as playback advances. A batch stops only after reaching at least 25 tracks, so albums are never split; if the genre pool is sparse the batch may be short and will stay genre-coherent rather than drifting to unrelated genres. For MPD, the connection manager refills below five remaining tracks and prevents overlapping fills; used albums are committed only after MPD accepts them and are not repeated until the cycle is exhausted, and the next cycle preserves albums still in the MPD queue. For browser, each `SessionPlayer` owns its own `AutoplayService` instance (via `SessionRegistry`) — `playTrack` appends an initial batch beyond the album slice, and `advance`/`tick` refills when <5 tracks remain with the same ranking and commit semantics. There is no autoplay toggle API.
- **CatalogSyncService** (`services/library/catalogSyncService.ts`) owns library sync — Sonect scans the filesystem itself; MPD is not the catalog source. It is invoked via `CatalogSyncOrchestrator.scanLibrary()`, and delegates to `LibraryScanner` (`services/library/libraryScanner.ts`). The scanner walks every enabled registered `storage_sources` path, **skips unchanged files by `(mtime, size)`** against the existing row, and parses only changed/new files with `music-metadata` (falling back to filename-based indexing when a file is unreadable). Deletion is **scoped per successfully-walked source prefix**: the first run (when the `scanner_version` marker is absent) drops legacy/MPD-sourced rows not seen in any walked source, while later runs delete only rows under a walked prefix that were not observed; rows under a **skipped subtree** (an unreadable directory, or an entry whose name is not valid UTF-8) are never deleted, on either run. All upserts/deletes run in one transaction via `catalogSyncDb.applyIncremental()` (per-track savepoints; constraint failures reported and skipped; any other error rolls back to the previous catalog). Unchanged tracks are left untouched, so `play_count`/`last_played` survive. Per-source `file_count`/`dir_count`/`total_size` are written with `storageDb.updateStats()` at the end of the walk. MPD `update` is decoupled and fire-and-forget — the scanner, not MPD, drives the catalog.
- The backend exposes its build version through `getSystemStatus()` →
  `/system/status[].version`. It reads `/app/.version` (written only by the
  release image via the `SONECT_VERSION` build-arg), defaulting to `"dev"`.
  Sources: `services/utils/appVersion.ts`.
- Host network management is intentionally not part of Sonect. Network status is
  exposed via `GET /system/health` (aggregated) and legacy `GET /system/network/status`,
  both returning `{ connected, dnsReachable }`. `connected` checks for a non-loopback
  IPv4 or IPv6 address, while `dnsReachable` resolves `DNS_CHECK_HOST` (default
  `example.com`) with a 3s timeout. The frontend polls **health** every **30s**
  (60s during library sync) for both backend liveness and network indicator —
  deduplicated via shared `qk.system.health()` key — and shows one localized
  indicator in the desktop top bar; it does not expose Wi-Fi scan/connect controls.

### Frontend

- Components follow the shadcn/ui pattern: primitive Radix UI components wrapped in `packages/frontend/src/components/`.
- **Design system** — every UI change must follow the `sonect-design-system` skill (semantic tokens only, three-size icon scale, ghost `icon-sm` row actions, Skeleton loading, `EmptyState` for every empty list, spacing/radius rhythm). Shared components: `EmptyState`, `PageHeader` (the only page `h1`), `LibraryStats`. The official `shadcn` and Anthropic `frontend-design` skills are installed under `.opencode/skills/`.
- Pages live in `packages/frontend/src/pages/`.
- Feature-specific logic (hooks, context, api, queries) lives in `packages/frontend/src/features/`.
- The `music-player.tsx` component interpolates elapsed time locally via `setInterval` (250ms ticks) during `state === "play"`. The elapsed anchor is reset on each WebSocket message from the server, keeping the progress bar smooth between MPD polls.
- Styling is Tailwind CSS 4; avoid inline styles.
- Use `lucide-react` for icons.
- Use `react-router-dom` v7 for routing.
- Use `i18next` / `react-i18next` for ALL user-visible strings. Every hardcoded label, heading, button text, menu item, aria-label, alt text, toast message, and placeholder must use `t("key.path")`. Translation keys live in `packages/frontend/src/i18n/locales/{lang}.json` (`en`, `es`, `it`). When building a new feature or component, define all labels in every locale as part of the implementation — never ship untranslated UI text. Plural keys use the i18next v4 suffixes (`_one`/`_other`).
- **Vite proxy** — When adding new backend route prefixes (e.g. `/playlists`), you **must** add a corresponding proxy entry in `packages/frontend/vite.config.ts` so the Vite dev server forwards those requests to the backend on port 3000.
- **Responsive design** — Every page and component must work at all viewport sizes. Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`). Never ship a layout that breaks below 375px (mobile). After any UI change, verify with Playwright at 3 viewport sizes: 375px (mobile), 768px (tablet), 1280px (desktop).
- **Data fetching — TanStack Query** — All REST fetching goes through `@tanstack/react-query` (v5). Idiomatic layout:
  - `lib/api.ts` — single `apiFetch<T>(path, {params, body, signal})` built on native `fetch` (`VITE_BACKEND_URL` base, `ApiError`/`NetworkError` throwing). No `ApiClient` class.
  - `lib/queryClient.ts` — `QueryClient` defaults: `staleTime: 30s`, `gcTime: 5m`, `retry:1`, `refetchOnWindowFocus:false`, `placeholderData: keepPreviousData`. Per‑query overrides: lists `60s`, static catalog `5m`, `stats` `2m`, `search` `10s`, polling `0 + refetchInterval`.
  - `lib/queryKeys.ts` — factory `qk` for stable keys (`qk.catalog.albumsInfinite(sort)`, `qk.playlists.detail(id)`, …) — use for `invalidateQueries`.
  - `features/<domain>/api.ts` — typed fetchers `(params, signal?) => Promise<T>` via `apiFetch`.
  - `features/<domain>/queries.ts` — `queryOptions`/`infiniteQueryOptions`/`mutationOptions` factories + thin hooks; `queryFn: ({signal})=> fetcher(..., signal)` for cancellation. Mutations invalidate via `queryClient.invalidateQueries({queryKey: qk...})`.
  - `App.tsx` wraps `QueryClientProvider` outermost; `ReactQueryDevtools` is `import.meta.env.DEV` only; `vite.config.ts` chunks `@tanstack` → `vendor-query`. Do **not** re‑introduce `ApiClient` or `PlaylistContext` — they were deleted in this migration; use `useQuery(playlistQueries.list())` etc. Keep `PlaybackContext`/`WebSocketProvider` for push state.

### Database

- `@repo/db` uses Node's built-in **`node:sqlite`** (`DatabaseSync`) wrapped by
  **Drizzle ORM** (`drizzle-orm/node-sqlite`, pinned to `1.0.0-rc.4`) — a
  synchronous driver. Node `22.14.0` is the minimum runtime for the driver;
  the repo itself pins `engines.node >=24.0.0` (`.nvmrc` = 24) and CI runs on
  Node 24. There is no separate Node 22 compatibility-floor job.
- Connection setup and teardown live in `packages/db/src/connection.ts`.
  `initDb()` applies the pragmas: `foreign_keys = ON`, `journal_mode = WAL`,
  `synchronous = NORMAL`, `busy_timeout = 5000`.
- **`closeDb()` ownership:** `backend/src/server.ts` is the sole owner of
  process termination. It calls `closeDb()` (which runs
  `PRAGMA wal_checkpoint(TRUNCATE)` and closes the handle) in every exit
  path — SIGTERM/SIGINT shutdown and startup failure. `@repo/db` installs
  **no signal handlers** of its own; never add process-level handlers to the
  package.
- **Schema changes:** `packages/db/src/tables.ts` is the **single schema
  source**. To change the schema, edit `tables.ts` and run `pnpm db:generate`
  (root alias; runs drizzle-kit generate in `@repo/db`), then commit the new
  versioned folder under `packages/db/drizzle/` (rc.4 layout:
  `<timestamp>_<name>/migration.sql` + `snapshot.json`). Never hand-edit the
  generated SQL. Never regenerate or delete an existing committed migration
  folder — always append a new one; existing databases track applied
  migrations by content hash. Note: drizzle-kit@1.0.0-rc.4 pairs with
  drizzle-orm@1.0.0-rc.4.
- **DB CLI:** `pnpm db:migrate` / `pnpm db:migrate-reset` are thin tsx
  scripts (`packages/db/src/scripts/`) reusing the same `connection.ts`
  pragmas and `MIGRATIONS_FOLDER` resolution as `initDatabase()` — do not
  bypass them with `drizzle-kit migrate`, which uses its own driver and
  skips the pragmas. They are dev conveniences only; production applies
  migrations automatically at startup. `pnpm db:studio` (drizzle-kit studio)
  requires the `better-sqlite3` devDependency and browses the dev DB at
  `DB_PATH` (`/db/music.db` in the dev container; an explicit `DB_PATH` is
  resolved from the repo root — unlike the backend, which resolves it from
  its own cwd, and `packages/backend/.env` pins it for `pnpm dev`). The
  relative `./data/music.db` fallback must never be relied on: it resolves
  per-process cwd, so backend and tooling can silently open different files
  (this exact drift once caused 500s on `/catalog/scan`).
- **Migrations:** `initDatabase()` (`packages/db/src/schema.ts`) applies
  pending migrations at startup via `migrate()` from
  `drizzle-orm/node-sqlite/migrator`, tracked in the `__drizzle_migrations`
  table. Legacy databases created before this system (any DB with our tables
  but no `__drizzle_migrations`) are **wiped and rebuilt** — play counts,
  playlists, storage sources, and setup flags are lost on upgrade. This is a
  deliberate one-time reset. The migrations folder is produced by the bundle
  script at `packages/backend/dist/drizzle` and copied into the app image's
  `/app/drizzle/` by the Dockerfile — **neither the bundle copy nor the
  Dockerfile `COPY` may be removed** (the migrator resolves `/app/drizzle/`
  from the bundle anchor and crashes with `ENOENT` otherwise).
- **Queries** live in the focused repository modules under
  `packages/db/src/repositories/` (`artists`, `albums`, `tracks`, `catalogSync`,
  `genres`, `playlists`, `syncMetadata`, `stats`, `storage`, `setup`,
  `profiles`). Put new queries there; the old `models.ts` no longer exists.
- **Raw SQL must stay inside `@repo/db`** and use Drizzle's typed `sql`
  template (or parameterized `prepare()` calls) — never string-concatenate
  values into SQL outside the package. Keep queries simple and indexed.

### Code style

- Prettier with `trailingComma: "all"` and the Tailwind CSS plugin.
- ESLint with `@typescript-eslint` rules (including `no-unused-vars`; there is no `unused-imports` plugin).
- Run `pnpm lint` before committing.
- No `console.log` in production code paths.
- No `any` without an explanatory comment.

### Testing

- Backend test suite in `packages/backend/src/__tests__/` using **Mocha**, **Chai**, **Sinon**, and **Supertest**.
- Tests mirror `src/`:
  - `unit/controllers/`, `unit/services/` — pure/unit tests (constructor/factory DI)
  - `integration/services/`, `integration/repositories/` (`db.*` + tracks), `integration/routes/`, `integration/ws/` — service/repo/route/ws integration (real `:memory:` DB via `helpers/db.ts`)
  - `e2e/` — full-stack `app` + `supertest`
- Mock external dependencies (MPD, DB, filesystem) with **Sinon** stubs/spies and constructor/factory DI. ESM module mocking is not used: `esmock` was removed because it cannot patch through the `tsx` loader for route/service/WS tests.
- Use **Sinon stubs + dynamic `import()`** when a module must be imported after stubs are set up (see route tests).
- **Route tests** build a minimal Express app via a local `makeApp()` helper and manually add `errorHandler` middleware.
- Before adding new test files, check existing patterns in `__tests__/` for consistency.

## Architecture notes

### MPD polling & cache flow

```
User action → executeCommand() → refreshNow() → status poll → stateChanged event → WebSocket broadcast
                                                                    ↓
                                                            PlaybackStatus cache
                                                                    ↓
                                                           getCachedStatus() (sync reads)
```

- The MPD connection is **polling-based**, not event-driven.
- Polling interval: **2s during play**, **10s during pause/stop**.
- After every user-initiated command, `playerService` fires `refreshNow()` (fire-and-forget) for a prompt cache refresh; if a poll is already in flight the refresh is skipped and the next tick applies.
- `playerService.ts` reads the cache synchronously. The only exception is `getQueue()` which executes `playlistinfo` as an async MPD query.

### WebSocket architecture

- WebSocket server shares the same HTTP port as Express (via `ws` package upgrade).
- On client connect: server immediately sends current cached playback status.
- Subsequent updates pushed via `stateChanged` events from the polling loop.
- All connected clients receive the same broadcast via `broadcast.ts` (`ws/broadcast.ts`), a utility that iterates `wss.clients` and sends JSON to all open connections.
- All WS messages follow a standard format with a `type` field: `"player-status"`, `"sync-progress"`, `"sync-complete"`, `"sync-error"`, or `"log"`.

### Unified per-session playback (`/player`)

` /player` is the **single** playback API (`routes/unifiedPlayerRoutes.ts`, controllers in `controllers/unifiedPlayerController.ts`). Every request requires `X-Session-Id` (`middleware/sessionId.ts` → 400 if missing) + optional `X-Device-Id` (per-browser random id from `lib/deviceId.ts` stored in `localStorage['sonect.deviceId']`) and always appends `?sessionId=&deviceId=` on the WS URL. There is **no frontend fork** between browser/MPD — `features/player/api.ts` calls only `/player/*`; the backend decides per session.

- **Session identity** — `lib/selectedProfile.ts` returns `profile.id` as `X-Session-Id` (legacy `lib/session.ts` delegates). `lib/deviceId.ts` generates a per-browser random id `localStorage['sonect.deviceId']` sent as `X-Device-Id`/`?deviceId=`. Profile = queue owner; device = output target.
- **PlayerRouter** (`services/player/playerRouter.ts`) — `Map<sessionId, {mode, engine, activeDeviceId, volume}>` singleton. `mode` is per-profile (`browser` default, `mpd` requires lock). `engine` is `SessionPlayer` wrapper or `MpdAdapter`. `activeDeviceId` is per-profile for `browser` mode (which browser device renders audio); `mpd` mode has `null`. Browser `PUT /player/output-mode {mode:'browser'}` with `X-Device-Id` hands off same `file+elapsed+state` to new device (no engine recreation), emits `stateChanged`. `setVolume` is stored per-profile for browser (remote volumes affect shared state) vs delegated to MPD. `getStatus()` merges `engine.getStatus()` + `volume` + `activeDeviceId` + `mode`.
- **Browser engine (shared per-profile)** — `SessionPlayer` (`services/session/sessionPlayer.ts`) per `SessionRegistry` (`services/session/sessionRegistry.ts` 30m idle sweep): single queue/clock per profile, auto-advance, `playTrack` queues through end of album then appends a smart autoplay batch, `pause`/`resume` control the clock. First `play` from a browser device auto-claims `activeDeviceId` if `null` (`setActiveDeviceIfUnclaimed`). Subsequent remote controls (play/pause/seek/volume) from passive devices mutate shared state but keep `activeDeviceId`. `random/repeat` are no-ops. Each `SessionPlayer` owns its own `AutoplayService` instance (no global singleton) with refill when <5 tracks remain.
- **MPD engine (shared, single-owner)** — `MpdAdapter` wraps `PlayerServiceImpl` + `MpdConnectionManager`. Shared global queue/daemon. `resume` uses explicit `pause 0`. Lock via `MpdConfigService.tryAcquireMpd(sessionId)` (`services/mpd/mpdConfigService.ts`); `PUT /player/output-mode {mode:'mpd'}` returns 423 if another session owns MPD. `mpd→browser` handoff sets `activeDeviceId` to requesting device.
- **WebSocket** — `ws/player.ws.ts` resolves `PlayerRouter.getStatus(q)` + `on("stateChanged")` for that profile and sends `{type:'player-status', ...status, activeDeviceId, mode}`. Legacy path without `sessionId` remains MPD-only. Frontend `components/ws-provider.tsx` appends `&deviceId=` and updates `activeDeviceId` in `PlaybackContext`; `features/dashboard/components/music-player.tsx` only calls `browserAudio.play()` when `outputMode==='browser' && (activeDeviceId===null || activeDeviceId===myDeviceId)`.
- **Legacy routes** — `/mpd` was removed. `/session` remains only for backend integration tests (not used by frontend). Vite proxy forwards `/player` (`frontend/vite.config.ts`).
- **Autoplay in sessions** — browser sessions now reuse the same smart-autoplay batches as MPD but per-profile (one `AutoplayService` per `SessionPlayer`); MPD still uses the singleton via `factory.ts` + `MpdConnectionManager` callback.

### Cover art pipeline

1. `coverSyncService.ts` (`services/library/coverSyncService.ts`) handles cover extraction using `music-metadata` for embedded art.
2. Filesystem covers (`cover.jpg`, `folder.jpg`, etc.) are checked first; embedded art is used as fallback. Covers are resized to **400×400 WebP** (`COVER_SIZE`/`COVER_QUALITY` envs) with `sharp`, saved to `COVERS_DIR` as `SHA1(artist+album).webp` (legacy `.jpg` auto-migrated on next sync).
3. Backend serves them under `/covers` with `Cache-Control: immutable` (30 days).

### Waveform pipeline (SoundCloud-style progress bar)

1. `waveformService.ts` (`services/library/waveformService.ts`) generates per-track waveforms on demand. It decodes audio via `ffmpeg` (`-f s16le -ac 1 -ar 8000`) and computes **120** normalized peaks (`0–255`) by `max(|sample|)/32768` per bin, scaling max to 255 for contrast — mirroring Monochrome's `waveform.js:168` `extractPeaks` (4 peaks/sec, capped 1000). If `ffmpeg` is missing or decode fails, a deterministic fallback envelope is used so the UI never shows a flat line.
2. Waveforms are cached as `SHA1(file).json` under `WAVEFORMS_DIR` (`{samples, duration, version:1}`) with atomic write + an in-memory `Map` (volatile, not an LRU) + request coalescing (`pendingGeneration` map). Served via `GET /waveforms/:trackId` (`routes/waveformRoutes.ts`, `controllers/waveformController.ts`) with `Cache-Control: immutable` (86400s). `Vite` proxy forwards `/waveforms` (`frontend/vite.config.ts`).
3. Frontend `components/waveform.tsx` renders a **canvas** SoundCloud-style bar waveform: `numBars=min(samples, floor(width/3))`, `barWidth=0.65*slot`, `gap=0.35*slot`, rounded `barHeight=max(2, peak*height*0.82)`, centered vertically. Played vs unplayed are two clipped fills (`--primary` vs `--muted-foreground` at 35% opacity) driven by `elapsed/duration` progress. `PlaybackWaveform` (`features/dashboard/components/playback-waveform.tsx`) fetches via `playerQueries.waveform(trackId)` (`lib/queryKeys.ts: qk.player.waveform`, 5m stale/30m gc), renders the **20px waveform track** (`h-5`) wrapped in a Radix slider (click-to-seek + a11y) and falls back to a 6px progress bar (`h-1.5`) when no waveform data is available. `music-player.tsx` + `full-page-player.tsx` pass `trackId={track?.id}`; on mobile (`md:hidden`) the player uses `PlaybackProgressBar` (`h-1.5`) instead. Responsive at 375/768/1280 via `ResizeObserver` + Tailwind.

### First-run setup wizard

- Route: `/setup`, guarded by `SetupGuard` (`components/setup-guard.tsx`), which wraps the routed page content in `MainLayout`. The first guard check in each browser-tab session calls `GET /system/setup/progress`, caches the backend `complete` result in `sessionStorage["setup-complete"]`, and redirects to `/setup` when it is false. Later checks in that tab use the cached backend result.
- The gate is **not** "all steps done": setup is considered complete only when a permanent done flag is set. The flag is a pseudo-step `complete` in the `setup_progress` table and is written by the explicit `POST /system/setup/complete` endpoint (the only intended writer), used by both Skip and Finish; the endpoint accepts any non-empty step name, so the invariant is by convention, not enforced. Updating an individual step or creating a storage source does not set it. `isSetupComplete()` does **not** consider existing storage sources — the stored `complete` flag is the single source of truth.
- `getSetupProgress()` (`services/setupService.ts`) reports steps in order `["storage", "audio", "sync"]`; the `storage` step's `completed` flag is **derived** from `storageDb.getAll().length > 0` (not stored), while `audio`/`sync` flags come from `setup_progress` rows.
- Frontend wizard steps: Welcome → Storage → Audio → Sync. An incomplete setup currently starts at Welcome.
- The Storage step shares components with Settings → Libraries: detected (unregistered) folders render as one-click **Add** rows (`DetectedLibraryRow`), an "Or add manually" form covers manual paths, and the success dialog shows the created library with `LibraryStats`. When at least one library is already registered the footer also shows **Continue**, so a re-run (after a setup reset) can never get stuck; with zero libraries, create remains required.
- Skip is persisted by the backend, so it applies to normal and private/incognito browser sessions. `sessionStorage["setup-complete"]` is only a per-tab cache of a confirmed backend result, not a local skip flag. `POST /system/setup/reset` (also exposed as the "Reset setup wizard" button in Settings → Debug) clears every `setup_progress` flag, invalidates the current tab's cache, and reloads without touching `storage_sources`. A reset performed by another tab is observed when a new tab session starts.

### MPD config handling

Sonect uses a **two-file architecture** for MPD configuration, both living in
the single container:

```
/etc/mpd/mpd.conf          (baked into the app image, immutable)
  └─ include ─► /app/data/mpd-audio.conf   (drop-in, owned by the backend)
```

- **`mpd.conf`** — baked from `docker/mpd.conf` into the app image at
  `/etc/mpd/mpd.conf` (`music_directory "/libraries"`, `bind_to_address
127.0.0.1`, `port 6600`, `log_file /app/data/mpd/mpd.log`, plus the `include`
  directive). **Never modified at runtime.**
- **`mpd-audio.conf`** (`process.env.MPD_CONFIG_PATH`, default
  `/opt/sonect/data/mpd-audio.conf`; set to `/app/data/mpd-audio.conf` in
  docker) — drop-in containing all user-editable settings: `audio_output`
  blocks and advanced config from the Settings UI. Written by the backend with
  `fs.writeFileSync`; the `mpd` s6 longrun creates it if absent.

**How it's read/edited:**

| Frontend tab | Service (`mpdConfigService.ts`)                  | What it does                          |
| ------------ | ------------------------------------------------ | ------------------------------------- |
| Audio tab    | `getCurrentAudioOutput` / `configureAudioOutput` | Reads/writes the `audio_output` block |

The full-config editor tab (and its `getConfig`/`updateConfig` service methods)
was removed; the drop-in is only written by `configureAudioOutput`, which
rewrites the `audio_output` block in place.

After every write the backend invokes its **injectable reload hook**
(`MpdConfigServiceImpl`'s `reload` constructor arg, defaulting to
`defaultReload`). The hook is supervisor-based: if `/run/service/mpd` exists
(the s6 image) it runs `s6-svc -r /run/service/mpd`; otherwise (dev, no s6) it
sends `SIGHUP` via `pkill -HUP mpd`. There is **no inotify watcher**, no
`systemctl`, no `sudo`, no privileged command anywhere. Tests inject a stub
hook so the reload can be asserted without touching MPD.

**Health:** the app image declares a Docker `HEALTHCHECK` polling
`GET /system/health` (interval 30s, start-period 30s). s6 restarts crashed
longruns internally; the HEALTHCHECK only reports status (it does not trigger
restarts under `restart: unless-stopped`).

**Writing new MPD config code:** always read/write the drop-in (not `mpd.conf`),
using `fs.readFileSync`/`fs.writeFileSync`. Never shell out.

**Dev container:** the `.devcontainer` reproduces this wiring without s6 —
`conf/mpd.conf` is bind-mounted to `/etc/mpd.conf` and includes the drop-in at
`/opt/sonect/data/mpd-audio.conf`, which `postCreate.sh` creates before starting
MPD. Do not remove the `include` directive from `conf/mpd.conf`; keep the drop-in
at the code default path (`MPD_CONFIG_PATH`) so dev behavior matches docker. Since
dev has no s6, the reload hook takes the `SIGHUP` branch (`pkill -HUP mpd`) and
the dev MPD process (started by `postCreate.sh`) restarts on its own. The Compose
mount is the main configuration and `postCreate.sh` must never overwrite
`/etc/mpd.conf`; overwriting it would make the mounted file include itself
recursively and can crash MPD with `SIGSEGV`.

### Library sources & per-source stats

- **`MUSIC_DIR` is MPD's single `music_directory`.** MPD can index exactly one
  tree, so every library must live under `MUSIC_DIR` (`/libraries` in docker) —
  that is why a source is defined as a path _under_ it rather than an arbitrary
  host path. A library source is just a **registered path under `MUSIC_DIR`**
  (name + path, no type, no credentials). The host bind-mounts each music folder
  into the single container (`/libraries/<name>`); the backend only validates
  that the path exists, stores it, and triggers a rescan. It never runs
  `mount`/`umount` and needs no elevated privileges.
- **`storageService.ts`** exposes `createStorageSource({name, path})`,
  `updateStorageSource(id, {name?, path?})`, `deleteStorageSource(id)`,
  `getStatsForPath(path)` and a read-only `listMounts()` (parses `/proc/mounts`).
  Creating or deleting a source, or updating its `path`, fires an MPD `update` +
  `scanLibrary()`; name/enabled-only edits do not rescan. `createStorageSource` is
  **async**: it computes initial stats with the non-blocking
  `computeSourceStatsAsync` walk and **persists** them via `storageDb.updateStats`
  before returning, so a fresh library never reads 0/0/0 while the scanner runs
  (the scanner walk still overwrites them as the long-term source of truth). The
  `storage_sources` table has no `type`/`uri`/`mount_path`/`username`/`password`
  columns.
- **Mount suggestions (`getDetectedLibraries`).** `storageService` lists the
  first-level directories under `MUSIC_DIR`, annotates each with `isMount`
  (cross-checked against `listMounts()`) and `registered`, and computes bounded
  on-disk stats (sync walk, 20k-file budget; omitted when exceeded). Exposed at
  `GET /system/storage/detected`; Settings → Libraries and the setup wizard offer
  the candidates (Plex/Immich style). It never throws for a single unreadable
  entry and omits stats rather than failing the suggestion.
- **On-demand stats (`GET /system/storage/stats?path=…`).** Computes stats for a
  first-level folder under `MUSIC_DIR` with the **async** walk and returns
  `{file_count, dir_count, total_size}`; 400 for missing/outside/nested/non-existent
  paths. Results are kept in an in-memory `detectedStatsCache` and merged into
  `getDetectedLibraries` responses (bounded live stats always win), so a
  user-computed result survives refetches until restart — used for folders whose
  bounded stats were omitted.
- **Frontend (Immich-style):** Settings → Libraries is one unified list: registered
  libraries (with per-row `LibraryStats`, refresh/edit/delete icon actions) and
  detected folders (with stats and a one-click **Add**; a **Compute stats** action
  appears when the budget omitted them). Registered folders never appear in the
  detected section. A collapsible compose-snippet box interpolates the first
  unregistered folder's real path.
- Per-source stats (`file_count` / `dir_count` / `total_size`) are produced by
  the scanner walk (`storageStats.walk`/`walkSource`/`computeSourceStats`) at the
  end of every `scanLibrary()` and saved via `storageDb.updateStats()`.
  `MUSIC_EXTENSIONS` (comma-separated; default `mp3,flac,ogg,oga,opus,m4a,aac,wav,wma,ape,wv,dsf,dff,mpc,tta`)
  selects which audio extensions are counted as music files.

### Library sync progress

Per-file progress during library sync now comes from Sonect's own scanner: as
`LibraryScanner` walks each source it emits `tracks`-phase `ScanProgress`
(`current`/`total`), which `CatalogSyncOrchestrator` broadcasts as a
`sync-progress` WS message. MPD's log file is no longer read for sync progress
(the former `mpdLogReader.ts` path was removed); MPD `update` is fire-and-forget.

**If a source root is unreadable**, the scanner skips the whole source (keeping
its catalog rows and previous stats) and continues with the remaining sources.
Inside a readable source, an unreadable subdirectory or an entry whose name is
not valid UTF-8 (Node decodes it lossily to `U+FFFD`, so it can no longer be
addressed by path) is skipped individually: the walk continues, a capped
warning names the path (with the errno, or the raw latin-1 name), every catalog
row under the skipped path is protected from deletion, and per-source stats
reflect the walked subset only. `storageStats.walk()` returns these `skipped`
paths; the sync, async, and budget walks all share this tolerance — only a root
failure throws. Fixing such names is a share-level concern (mount `iocharset`,
NAS charset, or renaming through a UTF-8 client); Sonect never renames files.

## What NOT to do

- All MPD communication must go through `MpdConnectionManager` (`executeCommand`/`executeCommandList`/`getCachedStatus`). Do not create additional MPD connections.
- Do not introduce privileged operations in the backend — no `mount`/`umount`, no `systemctl`, no `sudo`. Storage is host-provided (bind mounts) and MPD is reloaded by the backend's supervisor hook when its drop-in changes.
- Do not add new environment variables without documenting them here and in `README.md`.
- Do not commit `node_modules`, `dist/`, or `.env` files.
- Do not modify `pnpm-lock.yaml` manually.
- Do not add console.log debug statements in production paths.
- Do not ship a feature without updating the documentation. When implementing a new feature or making architectural changes, you must update `AGENTS.md` (for agent-facing architecture/patterns) and `README.md` (for user-facing config, env vars, or setup) as part of the implementation.

<!-- headroom:rtk-instructions -->

# RTK (Rust Token Killer) - Token-Optimized Commands

When running shell commands, **always prefix with `rtk`**. This reduces context
usage by 60-90% with zero behavior change. If rtk has no filter for a command,
it passes through unchanged — so it is always safe to use.

The devcontainer installs rtk automatically via `.devcontainer/postCreate.sh`
(user-level binary in `~/.local/bin`); it is not an npm/pnpm dependency.

## Key Commands

```bash
# Git (59-80% savings)
rtk git status          rtk git diff            rtk git log

# Files & Search (60-75% savings)
rtk ls <path>           rtk read <file>         rtk grep <pattern>
rtk find <pattern>      rtk diff <file>

# Test (90-99% savings) — shows failures only
rtk pytest tests/       rtk cargo test          rtk test <cmd>

# Build & Lint (80-90% savings) — shows errors only
rtk tsc                 rtk lint                rtk cargo build
rtk prettier --check    rtk mypy                rtk ruff check

# Analysis (70-90% savings)
rtk err <cmd>           rtk log <file>          rtk json <file>
rtk summary <cmd>       rtk deps                rtk env

# GitHub (26-87% savings)
rtk gh pr view <n>      rtk gh run list         rtk gh issue list

# Infrastructure (85% savings)
rtk docker ps           rtk kubectl get         rtk docker logs <c>

# Package managers (70-90% savings)
rtk pip list            rtk pnpm install        rtk npm run <script>
```

## Rules

- In command chains, prefix each segment: `rtk git add . && rtk git commit -m "msg"`
- For debugging, use raw command without rtk prefix
- `rtk proxy <cmd>` runs command without filtering but tracks usage

<!-- /headroom:rtk-instructions -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
