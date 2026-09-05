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
| `@repo/types` | `packages/types`    | Shared TypeScript types (no runtime deps)          |

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
`turbo` as a root devDependency). `dev`, `build`, `lint`, and `test` are
turbo tasks:

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
- `dev` is `cache: false` + `persistent: true` with `dependsOn: ["^build"]`,
  so workspace deps (`@repo/types`, `@repo/db`) are compiled before their
  consumers' watch processes start.
- Turbo cache lives in `.turbo/` (gitignored). CI does not benefit from the
  cache until a remote cache / `actions/cache` is wired up.

### Verification steps

After making changes:

1. `pnpm lint` — must pass with zero errors
2. `pnpm build` — must compile with zero errors (strict TypeScript)
3. `pnpm backend:test` — must pass (backend only has tests currently)

## Environment variables (packages/backend/.env)

| Variable           | Default                                                        | Purpose                                                             |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `MPD_HOST`         | `localhost`                                                    | MPD daemon hostname                                                 |
| `MPD_PORT`         | `6600`                                                         | MPD daemon port                                                     |
| `COVERS_DIR`       | —                                                              | Path where cover JPEGs are saved                                    |
| `MUSIC_DIR`        | `/music`                                                       | Root directory of the music library                                 |
| `MUSIC_EXTENSIONS` | `mp3,flac,ogg,oga,opus,m4a,aac,wav,wma,ape,wv,dsf,dff,mpc,tta` | Audio extensions counted as music files in per-source library stats |
| `PORT`             | `3000`                                                         | Backend HTTP server port                                            |
| `FRONTEND_DIST`    | `../frontend/dist`                                             | Path to built frontend static files (prod)                          |
| `MPD_LOG_PATH`     | `/var/lib/mpd/mpd.log`                                         | MPD log file (for per-file sync progress)                           |
| `DNS_CHECK_HOST`   | `example.com`                                                  | Host resolved to verify DNS connectivity                            |

## Production deployment (Raspberry Pi)

### Architecture

```
Single Node process on port 3000:
  Express API routes (/mpd, /library, /playlists, /system, /covers)
  + WebSocket server (ws)
  + Static file serving for built React frontend
  + SPA fallback (index.html for any unmatched GET)
```

### Build pipeline

- **Backend**: `pnpm backend:bundle` uses esbuild to bundle all JS code (Express, Zod, ws, music-metadata, workspace deps) into `dist/bundle.cjs`. Only `sharp` and `dotenv` remain external as runtime dependencies. The bundle defines `SONECT_BUNDLE_URL` via `--banner:js` and rewrites **all** `import.meta.url` occurrences via `--define:import.meta.url=SONECT_BUNDLE_URL` (currently only the `@repo/db` migrator uses it, to locate `dist/drizzle/`), then copies `../db/drizzle` to `dist/drizzle`. **Hazard:** if a future bundled dependency relies on `import.meta.url` for its own file's URL, it will silently receive the migrations-anchor URL instead.
- **Frontend**: `pnpm frontend:build` runs Vite, outputs static files to `frontend/dist/`.
- **Deployment artifact (via Release CI):** release-please
  (`release-please-config.json` + `.release-please-manifest.json`)
  owns the version/CHANGELOG/release on `main`. When a release is created, the
  `build-and-upload` job in `release.yml` bundles the backend and frontend and
  uploads a single `sonect.tar.gz` to the GitHub Release.
- **Artifact layout inside `sonect.tar.gz`:** `backend/` (`bundle.cjs`,
  `start-backend.sh`, minimal `package.json` with only `sharp`/`dotenv`,
  `pnpm-lock.yaml`, `.version`) and `frontend/` (static dist).
- **Installer:** downloads `releases/latest/download/sonect.tar.gz` with a
  plain `curl` — no PAT, no API. The running version comes from the bundled
  `backend/.version` file and is exposed via `GET /system/status` →
  `version` (fallback `"dev"` when absent).
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
  - Backend, db, and types packages use `typescript@7.0.2` directly (no typescript-eslint dep).
  - This setup is temporary. When typescript-eslint gains native TS 7 support (blocked on TS
    7.1 shipping a new programmatic API), remove both aliases from
    `packages/frontend/package.json` and restore `"typescript": "npm:typescript@^7.x"`.

### Backend

- Routes live in `packages/backend/src/routes/`.
- Business logic lives in `packages/backend/src/services/`.
- WebSocket handlers live in `packages/backend/src/ws/`.
- Controllers (input validation / response shaping) live in `packages/backend/src/controllers/`.
- **MpdConnectionManager** (`services/mpdConnectionManager.ts`) is a singleton that manages **two** TCP connections to MPD: a command client (`cmdClient`) and a polling client (`pollSocket`). The **cmdClient** uses the `mpd` npm package (v1.3.0) for command execution. The **pollSocket** uses raw TCP (`net` module) to send `status` commands directly — this avoids the `mpd` package's `idle`-based callback queue which caused silent polling failures. Polling happens on a timer: every 2s during `play`, every 10s during `pause`/`stop`. The in-memory `PlaybackStatus` cache is maintained and `stateChanged` events are emitted to subscribers on each poll. A `refreshNow()` method is also exposed for immediate cache refresh after user-initiated commands. When MPD disconnects, each connection auto-reconnects with exponential backoff (1s–30s).
- `playerService.ts` reads the cached status synchronously via `mpdConnectionManager.getCachedStatus()`. It delegates all commands to `mpdConnectionManager.executeCommand()` and calls `mpdConnectionManager.refreshNow()` after each command for immediate feedback. Note: `getQueue()` is an exception — it runs an async MPD query (`playlistinfo`).
- `player.ws.ts` sends the cached status to new WebSocket clients immediately on connect (wrapped in `{ type: "player-status", ... }` envelope), then forwards subsequent `stateChanged` events from the polling loop. All WS messages follow a standard format with a `type` field: `"player-status"`, `"sync-progress"`, `"log"`, or `"sync-complete"`.
- The `mpd` npm package (v1.3.0) is bundled into the backend output; it is only used for the `cmdClient`. The `pollSocket` uses raw TCP to avoid idle-protocol callback desync.
- Use `process.env` variables for configuration; never hard-code hosts, ports, or paths.
- **Zod validation** is applied directly in controller functions via `schema.parse(req.body)` / `schema.parse(req.params)`. Schemas are defined in `@repo/types` (`packages/types/src/schemas.ts`). `ZodError` propagates to `errorHandler` which returns a 400 response with `flatten().fieldErrors`.
- **asyncHandler** (`middleware/asyncHandler.ts`) wraps all async controllers; it **returns the promise chain** so tests can `await` it.
- **errorHandler** (`middleware/errorHandler.ts`) is registered in `app.ts` as the last middleware. Controllers throw `NotFoundError`/`ValidationError` for centralized handling.
- **autoplayService** (`services/autoplayService.ts`) is always active. A manual track selection queues that track through the end of its album, without wrapping to earlier tracks. Smart batches then add complete albums in this order: same artist → same genre → library-wide, ranking each tier by the sum of its tracks' `play_count` (title order breaks ties). Ranking stays anchored to the manually selected track as playback advances. A batch stops only after reaching at least 25 tracks, so albums are never split. The connection manager refills below five remaining tracks and prevents overlapping fills; used albums are committed only after MPD accepts them and are not repeated until the cycle is exhausted. The next cycle preserves albums still in the MPD queue. There is no autoplay toggle API.
- **mpdSyncService** (`services/mpdSyncService.ts`) handles library sync from MPD → SQLite, invoked via `scripts/sync.ts`. Tracks are fetched from MPD and deduplicated **before** any destructive database work — a failed fetch leaves the existing library untouched. The rebuild itself is a single transaction in `librarySyncDb.rebuild()` (`@repo/db` `repositories/librarySync.ts`): `play_count`/`last_played` are snapshotted first and restored for surviving files (they feed smart autoplay ranking), each track persists inside a savepoint, per-track constraint failures are reported and skipped, and any other error rolls the whole rebuild back to the previous library state.
- The backend exposes its build version through `getSystemStatus()` →
  `/system/status[].version`. It reads `backend/.version` (written only by the
  release CI), defaulting to `"dev"`. Sources: `services/appVersion.ts`.
- Host network management is intentionally not part of Sonect. The only network
  status endpoint is `GET /system/network/status`, which returns
  `{ connected, dnsReachable }`. `connected` checks for a non-loopback IPv4 or
  IPv6 address, while `dnsReachable` resolves `DNS_CHECK_HOST` (default
  `example.com`) through the system resolver with a short timeout. The frontend
  polls this endpoint every 15 seconds and shows one localized indicator in the
  desktop top bar; it does not expose Wi-Fi scan, connect, or disconnect controls.

### Frontend

- Components follow the shadcn/ui pattern: primitive Radix UI components wrapped in `packages/frontend/src/components/`.
- Pages live in `packages/frontend/src/pages/`.
- Feature-specific logic (hooks, context, slices) lives in `packages/frontend/src/features/`.
- The `music-player.tsx` component interpolates elapsed time locally via `setInterval` (250ms ticks) during `state === "play"`. The elapsed anchor is reset on each WebSocket message from the server, keeping the progress bar smooth between MPD polls.
- Styling is Tailwind CSS 4; avoid inline styles.
- Use `lucide-react` for icons.
- Use `react-router-dom` v7 for routing.
- Use `i18next` / `react-i18next` for ALL user-visible strings. Every hardcoded label, heading, button text, menu item, aria-label, alt text, toast message, and placeholder must use `t("namespace.key")`. Translation keys live in `packages/frontend/src/i18n/locales/{lang}.json`. When building a new feature or component, define all labels in both `en.json` and `es.json` as part of the implementation — never ship untranslated UI text.
- **Vite proxy** — When adding new backend route prefixes (e.g. `/playlists`), you **must** add a corresponding proxy entry in `packages/frontend/vite.config.ts` so the Vite dev server forwards those requests to the backend on port 3000.
- **Responsive design** — Every page and component must work at all viewport sizes. Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`). Never ship a layout that breaks below 375px (mobile). After any UI change, verify with Playwright at 3 viewport sizes: 375px (mobile), 768px (tablet), 1280px (desktop).

### Database

- `@repo/db` uses Node's built-in **`node:sqlite`** (`DatabaseSync`) wrapped by
  **Drizzle ORM** (`drizzle-orm/node-sqlite`, pinned to `1.0.0-rc.4`) — a
  synchronous driver. Node `22.14.0` is the minimum runtime; CI runs a
  `db-node-22-14-floor` job against that version.
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
  `packages/backend/data/music.db` (or `DB_PATH`, resolved from the repo
  root — unlike the backend, which resolves it from its own cwd).
- **Migrations:** `initDatabase()` (`packages/db/src/schema.ts`) applies
  pending migrations at startup via `migrate()` from
  `drizzle-orm/node-sqlite/migrator`, tracked in the `__drizzle_migrations`
  table. Legacy databases created before this system (any DB with our tables
  but no `__drizzle_migrations`) are **wiped and rebuilt** — play counts,
  playlists, storage sources, and setup flags are lost on upgrade. This is a
  deliberate one-time reset. The migrations folder ships in the release
  artifact at `backend/drizzle/` (see `release.yml`) and at
  `packages/backend/dist/drizzle` via the bundle script — **it must not be
  removed** from either.
- **Queries** live in the focused repository modules under
  `packages/db/src/repositories/` (`artists`, `albums`, `tracks`,
  `librarySync`, `playlists`, `syncMetadata`, `stats`, `storage`, `setup`).
  Put new queries there; the old `models.ts` no longer exists.
- **Raw SQL must stay inside `@repo/db`** and use Drizzle's typed `sql`
  template (or parameterized `prepare()` calls) — never string-concatenate
  values into SQL outside the package. Keep queries simple and indexed.

### Code style

- Prettier with `trailingComma: "all"` and the Tailwind CSS plugin.
- ESLint with `@typescript-eslint` rules and `unused-imports`.
- Run `pnpm lint` before committing.
- No `console.log` in production code paths.
- No `any` without an explanatory comment.

### Testing

- Backend test suite in `packages/backend/src/__tests__/` using **Mocha**, **Chai**, **Sinon**, **esmock**, and **Supertest**.
- Tests live in subdirectories mirroring `src/`: `controllers/`, `services/`, `routes/`, `ws/`.
- Mock external dependencies (MPD, DB, filesystem) with **esmock** (for ESM imports) and **Sinon** (for stubs/spies).
- **esmock** only exports default (`import esmock from "esmock"`), not `{ esmock }`.
- esmock cannot resolve relative imports in route/service/WS tests with our tsx setup; sinon + dynamic `import()` is used instead for route tests.
- **Route tests** create a minimal Express app in `before()` and manually add `errorHandler` middleware.
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
- After every user-initiated command, `refreshNow()` triggers an immediate poll so the UI updates without waiting for the next interval tick.
- `playerService.ts` reads the cache synchronously. The only exception is `getQueue()` which executes `playlistinfo` as an async MPD query.

### WebSocket architecture

- WebSocket server shares the same HTTP port as Express (via `ws` package upgrade).
- On client connect: server immediately sends current cached playback status.
- Subsequent updates pushed via `stateChanged` events from the polling loop.
- All connected clients receive the same broadcast via `broadcast.ts` (`ws/broadcast.ts`), a utility that iterates `wss.clients` and sends JSON to all open connections.
- All WS messages follow a standard format with a `type` field: `"player-status"`, `"sync-progress"`, `"log"`, or `"sync-complete"`.

### Cover art pipeline

1. `coverService.ts` (`services/coverService.ts`) handles cover extraction using `music-metadata` for embedded art.
2. Filesystem covers (`cover.jpg`, `folder.jpg`, etc.) are checked first; embedded art is used as fallback. Covers are resized to **500×500 JPEG** with `sharp`, saved to `COVERS_DIR` as `SHA1(artist+album).jpg`.
3. Backend serves them under `/covers` with `Cache-Control: immutable` (30 days).

### First-run setup wizard

- Route: `/setup`, guarded by `SetupGuard` (`components/setup-guard.tsx`), which wraps the routed page content in `MainLayout`. The first guard check in each browser-tab session calls `GET /system/setup/progress`, caches the backend `complete` result in `sessionStorage["setup-complete"]`, and redirects to `/setup` when it is false. Later checks in that tab use the cached backend result.
- The gate is **not** "all steps done": setup is considered complete only when a permanent done flag is set. The flag is a pseudo-step `complete` in the `setup_progress` table and is written only by the explicit `POST /system/setup/complete` endpoint, used by both Skip and Finish. Updating an individual step or creating a storage source does not set it. `isSetupComplete()` does **not** consider existing storage sources — the stored `complete` flag is the single source of truth.
- `getSetupProgress()` (`services/setupService.ts`) reports steps in order `["storage", "audio", "sync"]`; the `storage` step's `completed` flag is **derived** from `storageDb.getAll().length > 0` (not stored), while `audio`/`sync` flags come from `setup_progress` rows.
- Frontend wizard steps: Welcome → Storage → Audio → Sync. An incomplete setup currently starts at Welcome.
- Skip is persisted by the backend, so it applies to normal and private/incognito browser sessions. `sessionStorage["setup-complete"]` is only a per-tab cache of a confirmed backend result, not a local skip flag. `POST /system/setup/reset` (also exposed as the "Reset setup wizard" button in Settings → Debug) clears every `setup_progress` flag, invalidates the current tab's cache, and reloads without touching `storage_sources`. A reset performed by another tab is observed when a new tab session starts.

### MPD config handling

Sonect uses a **two-file architecture** for MPD configuration:

```
/etc/mpd.conf              (root-owned, written once by installer)
  └─ include ─► /opt/sonect/data/mpd-audio.conf  (service-user-owned, editable)
```

- **`/etc/mpd.conf`** — Minimal boilerplate (`music_directory`, `bind_to_address`,
  `port`, plus the `include` directive). Written by `installer.sh` as root.
  **Never modified at runtime.**
- **`/opt/sonect/data/mpd-audio.conf`** (or `process.env.MPD_CONFIG_PATH`) —
  Service-user-owned drop-in containing all user-editable settings: `audio_output`
  blocks and any advanced config from the Settings UI. Written by the backend
  Node.js process running as the service user — **no sudo required.**

**How it's read/edited:**

| Frontend tab   | Service            | What it does                                            |
| -------------- | ------------------ | ------------------------------------------------------- |
| Audio tab      | `audioService.ts`  | Reads drop-in via regex to extract `audio_output` block |
|                |                    | Writes `audio_output` block, then `restartMPD()`        |
| MPD Config tab | `configService.ts` | Reads full drop-in content via `fs.readFileSync`        |
|                |                    | Writes full drop-in via `fs.writeFileSync`,             |
|                |                    | then `sudo systemctl restart mpd`                       |

After every write, MPD is restarted so changes take effect. Both services use
`process.env.MPD_CONFIG_PATH`, defaulting to `/opt/sonect/data/mpd-audio.conf`.

**Writing new MPD config code:** always read/write the drop-in (not `/etc/mpd.conf`).
Use `fs.readFileSync`/`fs.writeFileSync` directly — no sudo needed.

**Dev container:** the `.devcontainer` reproduces this exact wiring — `conf/mpd.conf`
is bind-mounted to `/etc/mpd.conf` and includes the drop-in at `/opt/sonect/data/mpd-audio.conf`,
which `postCreate.sh` creates before starting MPD. Do not remove the `include` directive
from `conf/mpd.conf`; keep the drop-in at the code default path (`MPD_CONFIG_PATH`) so
dev behavior matches production.
The Compose mount is the main configuration and `postCreate.sh` must never
overwrite `/etc/mpd.conf`; overwriting it would make the mounted file include
itself recursively and can crash MPD with `SIGSEGV`.

### Local library sources & per-source stats

- **Local sources** are exposed to MPD via a **service-user-owned symlink** under
  `MUSIC_DIR` (default `/opt/sonect/music`, symlink at `/opt/sonect/music/<folder-name>`)
  pointing to a local folder outside the music directory — **no `sudo mount --bind`**.
  `storageService.ts` creates/replaces/removes the symlink on source
  create/update/delete and mount/unmount.
- **`mount_path` is derived, never user-supplied.** For every source type the
  frontend omits `mount_path`; `createStorageSource` generates a safe, unique
  subfolder name under `MUSIC_DIR` from the library name via
  `slugifyName()` + `generateUniqueMountSegment()` (for `local` it is the symlink
  target, for `smb`/`nfs` the mount point). `updateStorageSource` keeps an existing
  `mount_path` stable — editing a name never moves the symlink/mount point.
- **`follow_outside_symlinks "yes"`** is ensured in the MPD drop-in
  (`process.env.MPD_CONFIG_PATH`) by `configService.ensureFollowOutsideSymlinks()`
  so MPD can follow the symlink. Local folders must live outside `MUSIC_DIR`
  (validated in `storageService.ts`).
- Per-source stats (`file_count` / `dir_count` / `total_size`) are computed by
  `storageStats.scanStorageStats()` at the end of every `scanLibrary()` and saved
  via `storageDb.updateStats()`; they are shown in Settings → Libraries.
  `MUSIC_EXTENSIONS` (comma-separated; default `mp3,flac,ogg,oga,opus,m4a,aac,wav,wma,ape,wv,dsf,dff,mpc,tta`)
  selects which audio extensions are counted as music files.

### MPD log file for sync progress

Per-file progress during library sync is read from MPD's log file at `/var/lib/mpd/mpd.log`
(overridable via `MPD_LOG_PATH` env var). The installer writes `log_file "/var/lib/mpd/mpd.log"`
into `/etc/mpd.conf`. The `mpdLogReader.ts` service reads new lines from this file during
`updateLibrary()` and broadcasts each `update: added <path>` line as a `sync-progress` WS
message.

**If log file is missing or unreadable**, the MPD update phase proceeds without per-file
progress (graceful degradation — the subsequent `tracks` phase still shows per-track
progress).

## What NOT to do

- All MPD communication must go through `MpdConnectionManager` (`executeCommand` / `getCachedStatus`). Do not create additional MPD connections.
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
