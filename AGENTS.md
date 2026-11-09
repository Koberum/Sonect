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
pnpm frontend:test      # Run frontend tests (Vitest)
pnpm frontend:test:watch # Frontend tests in watch mode (from packages/frontend)
pnpm frontend:size      # Check the built JS gzip budget (after frontend:build)
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
3. `pnpm backend:test` — backend suite (Mocha/Chai/Sinon/Supertest)
4. `pnpm frontend:test` — frontend suite (Vitest)

## Verifica frontend

C'è una sola app frontend nel monorepo:

| Package    | Comando dev         | URL                     | Dipendenze                                                |
| ---------- | ------------------- | ----------------------- | --------------------------------------------------------- |
| `frontend` | `pnpm frontend:dev` | <http://localhost:5173> | Backend su `:3000`; `pnpm dev` per avviare tutto lo stack |

- `pnpm frontend:dev` esegue `pnpm --filter frontend dev` (`vite --host`); la porta è 5173 (default Vite).
- Il backend serve auth, catalogo, streaming e WebSocket sulla porta 3000; si avvia con `pnpm backend:dev`. Per lo stack completo usa `pnpm dev`, che precompila `@repo/types` e `@repo/db` prima di avviare i watcher.
- Vite fa proxy di `/auth`, `/catalog`, `/player`, `/playlists`, `/likes`, `/dashboard`, `/covers`, `/stream`, `/waveforms`, `/system`, `/profiles` e `/ws` verso `http://localhost:3000`.
- Non esiste un task `turbo run dev`: `turbo.json` definisce solo `build`, `lint` e `test`; lo script root `dev` usa `concurrently`.
- Playwright MCP (`playwright` in `opencode.json`, config del browser in `.opencode/playwright-mcp.json`) gira in headless Chromium a 1440×900. Usa i suoi tool per aprire l'URL, leggere lo snapshot di accessibilità, fare screenshot e controllare console e network.
- `.opencode/playwright-mcp.json` passa `--disable-software-rasterizer` a Chromium: senza questo flag gli screenshot headless vanno in timeout in questo container. Non rimuoverlo.
- Il browser Playwright si installa una volta dalla root con `pnpm dlx @playwright/mcp@latest install-browser chromium`; non aggiungere Playwright alle dipendenze dei package. Gli output finiscono in `.playwright-mcp/` (gitignored).

Regole:

- Dopo ogni modifica alla UI, avvia solo l'app interessata: `pnpm frontend:dev` per modifiche solo frontend. Avvia anche il backend (o `pnpm dev`) solo se la pagina richiede API/auth/streaming.
- Verifica la modifica a 375px, 768px e 1280px prima di dichiararla completata (vedi anche "Verification steps").

## Environment variables (packages/backend/.env)

| Variable           | Default                                                         | Purpose                                                                             |
| ------------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `MPD_HOST`         | `localhost`                                                     | MPD daemon hostname                                                                 |
| `MPD_PORT`         | `6600`                                                          | MPD daemon port                                                                     |
| `COVERS_DIR`       | `./data/covers`                                                 | Path where cover WebPs are saved                                                    |
| `COVER_SIZE`       | `400`                                                           | Cover resize dimension (px, square fit inside)                                      |
| `COVER_QUALITY`    | `80`                                                            | WebP quality for covers                                                             |
| `MUSIC_DIR`        | `/opt/sonect/music` (code default; `/libraries` in docker)      | Root directory of the music library                                                 |
| `MUSIC_EXTENSIONS` | `mp3,flac,ogg,oga,opus,m4a,aac,wav,wma,ape,wv,dsf,dff,mpc,tta`  | Audio extensions counted as music files in per-source library stats                 |
| `PORT`             | `3000`                                                          | Backend HTTP server port                                                            |
| `FRONTEND_DIST`    | `@frontend/dist` (cwd-relative; `/app/frontend/dist` in docker) | Path to built frontend static files (prod)                                          |
| `WAVEFORMS_DIR`    | `<COVERS_DIR>/../waveforms` or `./data/waveforms`               | Path where waveform JSON caches are saved (SHA1(file).json)                         |
| `LOG_LEVEL`        | `info`                                                          | Console log level (`debug`/`info`/`warn`/`error`)                                   |
| `MPD_LOG_PATH`     | —                                                               | Legacy; not read by Sonect (sync progress comes from the MPD protocol, not the log) |
| `CORS_ORIGIN`      | — (empty → same-origin only)                                    | Comma-separated exact origins allowed to make credentialed cross-origin requests    |
| `COOKIE_SECURE`    | — (false)                                                       | Set to `true` when Sonect is served over HTTPS so the session cookie is `Secure`    |

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

- `/player` is the single playback API. Requests require the `sonect_session`
  auth cookie (`authenticate` + `requireAuth`) and take the queue owner from
  `req.auth.profileId`; legacy `/mpd` and `/session` routes were removed, so
  `/player` is the only playback API.
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
  service tree, and runs `ENTRYPOINT ["/init"]` with an
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
- **Version**: the UI version comes from `packages/frontend/package.json`
  (release-please `extra-files` keeps it in sync with the release) and is
  injected at build time as `__APP_VERSION__` by `vite.config.ts`; Settings →
  Debug renders it. There is no `/app/.version` file, no `SONECT_VERSION`
  build-arg, and no version endpoint on the backend.
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
- **MpdConnectionManager** (`services/mpd/mpdConnectionManager.ts`) is a singleton that manages **two** TCP connections to MPD: a command client (`cmdClient`) and a polling client (`pollSocket`). The **cmdClient** uses the `mpd` npm package (v1.3.0) for command execution. The **pollSocket** uses raw TCP (`net` module) to send `status` commands directly — this avoids the `mpd` package's `idle`-based callback queue which caused silent polling failures. Polling happens on a timer: every 2s during `play`, every 10s during `pause`/`stop`. The in-memory `PlaybackStatus` cache is maintained and `stateChanged` events are emitted to subscribers on each poll. A `refreshNow()` method is also exposed for immediate cache refresh after user-initiated commands. When MPD disconnects, each connection auto-reconnects with exponential backoff (1s–30s). At `LOG_LEVEL=debug`, command and command-list responses are logged with bounded, single-line raw previews; poll `status.error` values are logged only on transitions and copied to `PlaybackStatus.error`.
- `playerService.ts` reads the cached status synchronously via `mpdConnectionManager.getCachedStatus()`. It delegates commands to `mpdConnectionManager.executeCommand()` / `executeCommandList()` and fires `mpdConnectionManager.refreshNow()` (fire-and-forget with `.catch`) after each command for prompt feedback; if a poll is already in flight the refresh is skipped and the next tick applies. Note: `getQueue()` is an exception — it runs an async MPD query (`playlistinfo`).
- `player.ws.ts` authenticates the handshake with the session cookie, sends the authenticated profile's status immediately on connect (wrapped in `{ type: "player-status", ... }` envelope), then forwards that profile's `stateChanged` events from the player router. It also accepts inbound `{ type: "player-report", state?, elapsed?, event?, trackId?, epoch?, fromTrackId? }` messages from the active browser device (see the unified playback section). All WS messages follow a standard format with a `type` field: `"player-status"`, `"player-report"`, `"sync-progress"`, `"sync-complete"`, `"sync-error"`, or `"log"`.
- The `mpd` npm package (v1.3.0) is bundled into the backend output; it is only used for the `cmdClient`. The `pollSocket` uses raw TCP to avoid idle-protocol callback desync.
- Use `process.env` variables for configuration; never hard-code hosts, ports, or paths.
- **Zod validation** is applied directly in controller functions via `schema.parse(req.body)` / `schema.parse(req.params)`. Schemas are defined in `@repo/types` (`packages/types/src/schemas/types.ts`, re-exported from `packages/types/src/schemas/index.ts`). `ZodError` propagates to `errorHandler` which returns a 400 response with `flatten().fieldErrors` under `details`.
- **asyncHandler** (`middleware/asyncHandler.ts`) wraps all async controllers; it **returns the promise chain** so tests can `await` it.
- **errorHandler** (`middleware/errorHandler.ts`) is registered in `app.ts` as the last middleware. Controllers throw `NotFoundError`/`ValidationError` for centralized handling.
- **autoplayService** (`services/mpd/autoplayService.ts`) is always active for both MPD and browser sessions. A manual track selection queues that track through the end of its album, without wrapping to earlier tracks. Smart batches then add complete albums in this order: same artist → same genre → similar genres → (genre-less only) library-wide, ranking each tier by the sum of its tracks' `play_count` (title order breaks ties). Similar genres are resolved via `services/mpd/genreSimilarity.ts`: a curated map for common tags (e.g. `techno → tech house, minimal, house…`) with token/substring fallback for arbitrary MPD `Genre` tags (`Vaporwave → Vapor House` via `genresDb.getAll()` substring match). Ranking stays anchored to the manually selected track as playback advances. A batch stops only after reaching at least 25 tracks, so albums are never split; if the genre pool is sparse the batch may be short and will stay genre-coherent rather than drifting to unrelated genres. For MPD, the connection manager refills below five remaining tracks (or when MPD reports no `nextsong`, which is the reliable signal in random mode) and prevents overlapping fills; used albums are committed only after MPD accepts them and are not repeated until the cycle is exhausted, and the next cycle preserves albums still in the MPD queue. For browser, each `SessionPlayer` owns its own `AutoplayService` instance (via `SessionRegistry`) — `playTrack` appends an initial batch beyond the album slice, and `advance` refills when <5 tracks remain with the same ranking and commit semantics. Autoplay refills are suspended in both engines while repeat is not `off`, so the queue end stays reachable; there is no autoplay toggle API.
- **MpdCatalogSyncService** (`services/library/mpdCatalogSyncService.ts`) owns library sync — **MPD is the catalog source**. It is invoked via `CatalogSyncOrchestrator.scanLibrary({force?})`. Each sync: triggers MPD `update` and polls `status.updating_db` until it finishes; reads MPD `stats` (`songs`, `db_update`) and skips the fetch when the stored markers and `tracksDb.count()` still match (unless `force`); pages MPD with `count "(file != '')"` + `find "(file != '')" window START:END`; parses the records; attributes each file to the most specific registered `storage_sources` path (longest prefix, stored as `tracks.storage_source_id`); diffs against `tracksDb.getSyncSnapshot()` in memory; and applies only new/changed/deleted rows in one transaction via `catalogSyncDb.applyIncremental()` (per-track savepoints; constraint failures reported and skipped; any other error rolls back the previous catalog). Unchanged tracks are untouched, so `play_count`/`last_played` survive. A failed read applies nothing. If MPD reports zero songs while a registered library still contains audio files, the sync aborts and keeps the catalog. `MUSIC_DIR` is MPD's single `music_directory`; every MPD song is mirrored, including folders not registered as a Sonect library (unregistered tracks still show with `storage_source_id = NULL`). MPD `update` is no longer fire-and-forget from storage changes — the sync owns it.
- **Audio format:** MPD's `Format` (`samplerate:bits:channels`) is parsed by `parseMPDTracks` into `format`/`sampleRate`/`bitsPerSample`/`channels`; the catalog sync persists `tracks.sample_rate`, `tracks.bits_per_sample` and `tracks.channels` (all nullable). `getSyncSnapshot`, `trackChanged` and `upsertTrack` include the three fields; `CATALOG_SCHEMA_VERSION` is `"3"` so the first sync after this schema change reprocesses existing rows. MPD's `Format` is a decoder approximation for lossy files: Sonect displays it as reported and never parses audio files for this data.
  - **Album identity is title + album artist** (case-insensitive title, `AlbumArtist` falling back to the track artist). `findOrCreateAlbum` (`repositories/albums.ts`) matches on both and adopts a title-only row once an artist becomes known; `albums_title_artist_unique` enforces it. `trackChanged` compares `album_artist_name`, so a sync splits albums that older builds had merged by title. After applying, `applyIncremental` prunes albums left with no tracks.
  - **Catalog schema marker:** `sync_metadata.catalog_schema` (exported `CATALOG_SCHEMA_VERSION`) is part of `isCurrent`, so bumping it forces one full reprocess after an identity-rule change; it is stamped only when no per-track errors occur.
  - **Duplicate copies in album views:** the same song stored under several paths stays as separate rows (MPD mirror + `tracks.file` unique), but `tracksDb.getByAlbumWithRelations` and `getByAlbumOrdered` collapse copies with the key `album_id + disc_number + track_number + lower(trim(title))` (the track artist is ignored because copies may tag it differently; the album already carries the album artist). When copies differ in format, the lossless one (`flac/wav/aiff/aif/ape/alac/dsf/dff/wv/tta`) is kept as canonical. Album detail and album playback therefore show one row per logical position; global search, existing playlists, and library file counts still reflect every physical file.
- The backend exposes no version or health-diagnostics endpoint. `GET /health`
  is a dependency-free public liveness probe used only by the Docker
  `HEALTHCHECK`; it returns `{ status: "ok" }`. Host network management is
  intentionally not part of Sonect: no Wi-Fi scan/connect controls and no
  network-status reporting, and the frontend has no liveness banner or health
  polling.
- **Catalog listings only include artists that own an album.** `CatalogServiceImpl.getAllArtists`/`getArtistCount` call `artistsDb.getAll`/`count` with `{ withAlbumsOnly: true }`, and `searchTracks` does the same for `artistsDb.search`. Artists created only as track artists (collaboration credits) are hidden so no result opens an empty artist page; the repository methods default to unfiltered for lookups/maintenance. `playHistoryDb.recentArtists` applies the same `artistsWithAlbums()` predicate, so the dashboard's recently played artists never include album-less artists either.
- **`GET /catalog/stats` is global**, not per profile: it counts the whole mirrored catalog and every playlist row. It is an admin-facing overview; per-profile plays and likes are reported by the dashboard instead.
- **Track rows and actions.** Album, liked, genre, and playlist tables share `features/tracks/components/track-row.tsx` (number/playing bars, title + artist subtitle, optional cover, duration, three-dot menu) and `track-table-header.tsx`. The three-dot `track-actions-menu.tsx` opens a dropdown on desktop and a right-side sheet on mobile with Play, Add to queue, Like/Unlike, Add to playlist, and optional Remove; it replaced the old right-click context menu. Track play is bound to the number/title/duration cells only, and the actions wrapper stops click/pointer events from bubbling (including through portals), so opening the menu or using a sheet/dialog action never starts playback. The playing row is highlighted with `bg-primary/10`, `text-primary` title, and animated bars in the number column; `AddToPlaylistDialog` (`features/playlists/components/`) handles playlist selection and creation.
- **Track quality.** `TrackTable` shows a desktop-only Quality column (`hidden md:table-cell`) only when at least one visible track has format data. The header cycles sort none→desc→asc (bit depth, then sample rate, nulls last) and a funnel menu filters by the exact `bits:rate` quality; album, genre and playlist tables filter client-side, while Liked Songs uses `GET /likes?quality=bits:rate&sort=quality-desc|quality-asc` (the response includes `qualities`; `POST /likes/play` accepts the same filter/sort). The column value is `48 kHz / 24 bit` (available parts only). Mobile hides the column and the track actions sheet adds a mobile-only Info item that opens `TrackInfoDialog` with details and audio rows. Album headers no longer show format badges; `deriveAlbumMetadata` has no `formats`.

### Frontend

- Components follow the shadcn/ui pattern: primitive Radix UI components wrapped in `packages/frontend/src/components/`.
- **Design system** — every UI change must follow the `sonect-design-system` skill (semantic tokens only, documented icon scale where `button.tsx` renders every in-button icon at `size-5` (20px), `bare` `icon-sm` actions for icon-only buttons (no hover background; only the icon highlights), Skeleton loading, `EmptyState` for every empty list, spacing/radius rhythm). Shared components: `EmptyState`, `PageHeader` (the only page `h1`), `LibraryStats`. The official `shadcn` and Anthropic `frontend-design` skills are installed under `.opencode/skills/`.
- **Color templates** — the Appearance tab offers three built-in palettes, each with light and dark variants: Sonect (amber, default), Graphite (neutral), and Ocean (cool green-teal). Every template is a full token sheet in `packages/frontend/src/themes/*.css` (imported by `index.css`); `<html>` carries `data-theme="sonect|graphite|ocean"` and the existing `.dark` class selects the mode. `ThemeProvider` persists the template in `localStorage["sonect.theme.template"]` and the mode in `vite-ui-theme`; an inline script in `index.html` applies both before first paint. Add a template by creating the CSS sheet, importing it in `index.css`, adding an entry to `themes/index.ts`, and adding `themeTemplates.<id>.name` / `.description` to all three locale files. Keep `--success`/`--warning` and the `sync-progress` keyframes in every theme sheet/`index.css`.
- Pages live in `packages/frontend/src/pages/`.
- Feature-specific logic (hooks, context, api, queries) lives in `packages/frontend/src/features/`.
- **Navigation is section + tab based.** There is no separate top navigation bar: the desktop sidebar carries the Sonect logo at the top (theme-aware, links to `/discover`); the signed-in profile is an avatar-only `ProfileSwitcher` at the right end of the global toolbar; its popover opens down-left on hover for fine pointers, with the same 300 ms close grace as the player popovers (both share `hooks/useHoverPopover.ts`). The desktop sidebar has five entries: **Discover** (`/discover`), **Library** (`/library`), **Playlists** (`/playlists`), **Queue** (`/queue`) and **Settings** (`/settings`, admin only). At the bottom of the desktop sidebar, a **status center** (`features/status/`) shows library statistics at rest (tracks, albums, artists, last sync) and the highest-priority active status: sync progress/error, WebSocket reconnection, unavailable library folders, or missing audio output/MPD. It is a card when expanded and a status-dot icon with a tooltip when collapsed; clicking opens a popover with every status, the full sync progress, statistics, and admin links. Below 768px the sidebar is replaced by an icon-only bottom nav (`layout/mobile-nav.tsx`) with **Player** (`/player`), **Queue** (`/queue`), a centered **Search** button, **Discover** (`/discover`) and **Settings** (admin only); `/player` is the mobile full player, and Library, Playlists and the profile switcher are not in the mobile nav. Mobile has no permanent status element: an activity pill appears above the bottom nav only while a status is active and opens the same content in a bottom sheet. `components/section-toolbar.tsx` (back/forward history buttons, global search and the profile switcher) is rendered by `MainLayout` above the routed content only at ≥768px, so mobile has no top toolbar; the centered Search button opens the same `SearchCommand` in a controlled full-screen overlay rendered by `MainLayout`, with the input focused immediately. On desktop the toolbar stays mounted while sections and tabs change and only the content area swaps. Each section is a layout route rendering `components/section-layout.tsx`, which at the section root renders the sr-only `h1` and horizontal `components/section-tabs.tsx` — shadcn/Radix `Tabs` held in local `activeTab` state, **never routes**: switching tabs creates no history entry and the URL stays `/discover`, `/library` or `/settings`, and deep links to a specific tab are not supported. Only the active `TabsContent` mounts and each is wrapped in its own `Suspense` with a content skeleton, so a lazy page never replaces the toolbar, the tabs or the player. Detail routes (`/playlists/:id`, `/library/albums/:id`, `/library/artists/:artistId`, `/library/genres/:genre`) are real routes: they hide the tabs and render their own entity `PageHeader`, so the entity name is the only `h1`; the section stays mounted, so going back restores the tab you left. Legacy tab URLs (`/home/listen`, `/home/liked`, `/library/albums`, `/library/artists`, `/library/genres`, `/library/statistics`, `/settings/audio|playback|libraries|appearance|debug`) redirect to the section root passing `state.tab`. Legacy URLs (`/albums`, `/artists/:artistId/albums`, `/genres`, `/liked`, `/tracks`, `/library/stats`, `/settings`) redirect to their new location; `/home` redirects to `/discover`, `/home/playlists` to `/playlists`, and `/home/playlists/:id` to `/playlists/:id`. Playlist creation and listing live in the **Playlists** section (`/playlists`, a dedicated top-level page like Queue) and are **per profile**: `playlists.profile_id` scopes every read/write, names are unique per profile, and requests for another profile's playlist return 404. MPD playlists share one global namespace, so each Sonect playlist is mirrored under `sonect-<id>` in MPD while the display name lives in the database. Dragging any track row or track card opens the right-hand playlist drop panel (`features/playlists/components/playlist-drop-provider.tsx`): playlists show a 2×2 cover collage plus title/description, `dragover` highlights the target, and dropping calls `playlistMutations.addTrack`. The panel also allows creating a playlist: clicking the dashed zone opens the normal creation dialog, while dropping a track on it creates a playlist with a unique temporary name (`"My playlist 1"`, `"My playlist 2"`, …) and adds the track immediately. Drag is desktop-only, so "Add to playlist" in the track actions menu remains the touch/keyboard path. The sidebar is 208px wide (`w-52`) and full-height; between 768px and 1279px it is forced to the 64px icon rail (`w-16`) with no toggle, while at ≥1280px the toggle next to the logo switches the persisted `localStorage["sonect.sidebar.collapsed"]` state. Below 768px the sidebar is hidden and the bottom nav is the only section navigation. The compact player is a desktop-only flex footer of the content column, not fixed across the viewport; below 768px it is hidden and the full player route renders above the bottom nav.
- **Media cards.** Album, artist, playlist and track cards in grids and carousels all render through `features/catalog/components/media-card/media-card.tsx`: `bg-card` with `p-3`, square artwork (2×2 collage when 4 covers are available), hover/focus like button (tracks only) and a three-dot actions menu, title plus "artist · year" (year from `album.year` or the leading 4 digits of `track.date`; playlists show the track count). The thin adapters are `AlbumCard`, `ArtistCard`, `TrackCard`, `PlaylistCard`. Grids use `grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6`; Dashboard carousels use `w-44 shrink-0`. Table lists (album tracks, liked, playlist detail, genre tracks) keep their compact rows.
- **Player views share one engine.** `features/player/player-engine-context.tsx` (`PlayerEngineProvider`/`usePlayerEngine`) owns the single `useBrowserAudio` instance, the server→engine sync effects, remote seeks, crossfade, preload and elapsed interpolation. The shared `PlaybackContext` derives the now-playing track, output mode and active device from the single authoritative `PlaybackStatus`. It is mounted by `MainLayout`, so playback survives route and viewport changes. `music-player.tsx` is the desktop-only compact bar; `full-page-player.tsx` is the mobile `/player` page (desktop redirects to `/discover`) and consumes the same provider. The full player has no queue and no visible page title: it is cover, left-aligned title/artist, waveform, enlarged controls and a full-width horizontal volume slider with the icon on the right, always visible (no popover). Artwork and title/artist share one centered column capped at 320px, so the text always lines up with the artwork edge. The desktop compact bar keeps the hover popover with the vertical slider. The active browser reads the real `audio.currentTime`; MPD/passive devices interpolate elapsed time locally via `setInterval` (250ms ticks), freezing while `PlaybackStatus.buffering` is true. No view advances a browser progress bar from a server clock. The output picker (`features/player/components/output-selector.tsx`) is a Popover anchored to its trigger: on fine pointers it opens on hover via the shared `hooks/useHoverPopover.ts` hook (300 ms close grace, click-pins and skips autofocus), while touch and keyboard use the trigger; in the compact bar it opens upward with the volume popover's 32 px offset so it rests on the player bar, and the full-page player opens it below the trigger (`placement="page"`).
- **Queue section.** `pages/QueuePage.tsx` (`/queue`) is the per-profile queue UI, reachable from the desktop sidebar and the mobile bottom nav. It uses `@dnd-kit` sortable rows for drag/keyboard reordering, with optimistic updates and polling paused during a drag; rows support play, like, remove and the page has a confirmed "Clear queue" action. `features/player/components/queue-view.tsx` was removed, and neither player view renders a queue. Album/artist card enqueue uses `POST /player/queue/bulk` with `{files: string[]}` (max 500): the server appends in order and returns `{status, added, failed[]}`, using 200 for partial success and 422 when no file could be queued.
- Styling is Tailwind CSS 4; avoid inline styles.
- Use `lucide-react` for icons.
- Use `react-router-dom` v7 for routing.
- Use `i18next` / `react-i18next` for ALL user-visible strings. Every hardcoded label, heading, button text, menu item, aria-label, alt text, toast message, and placeholder must use `t("key.path")`. Translation keys live in `packages/frontend/src/i18n/locales/{lang}.json` (`en`, `es`, `it`). When building a new feature or component, define all labels in every locale as part of the implementation — never ship untranslated UI text. Plural keys use the i18next v4 suffixes (`_one`/`_other`).
- **Vite proxy** — When adding new backend route prefixes (e.g. `/playlists`), you **must** add a corresponding proxy entry in `packages/frontend/vite.config.ts` so the Vite dev server forwards those requests to the backend on port 3000. `/player` is both the mobile player page and the playback API prefix, and `/playlists` is both the playlists page and the playlist API prefix, so both proxy entries have a `bypass` for `GET` document requests (`Accept: text/html`): those load the SPA instead of the API. In production the backend serves `index.html` for document requests to `/player`, `/playlists` and `/playlists/*` before the authenticated routers (see `app.ts`); `GET /playlists` API calls keep their default `Accept: */*` and reach the playlist router.
- **Responsive design** — Every page and component must work at all viewport sizes. Use Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`). Never ship a layout that breaks below 375px (mobile). After any UI change, verify at 3 viewport sizes using the browser's responsive mode: 375px (mobile), 768px (tablet), 1280px (desktop).
- **Global search** — `features/search/components/search-command.tsx` renders a dropdown (desktop toolbar) or a controlled overlay (mobile, opened by the centered bottom-nav button and focused immediately) from `GET /catalog/search`. The response includes `artists`, `albums`, `tracks` and `genres`; `genresDb.search` matches genre names case-insensitively (max 5, ordered by name). Matching genres render as clickable `Badge`s in a wrapping row **above** the result sections (no section heading, `aria-label` from `search.genres`), are part of the arrow/Enter navigation as the first items, and open `/library/genres/<name>` on activation. A query that matches only genres does not show the empty-results message.
- **Recent searches** — `features/search/recent-searches.ts` keeps the last 5 search terms per profile in `sessionStorage` (`sonect.recentSearches.<profileId>`). They are captured only when a result is activated (never on each keystroke), shown when the search input is empty, and are navigable with the same arrow/Enter flow as results. No backend/DB involvement.
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
  `genres`, `playlists`, `playHistory`, `syncMetadata`, `stats`, `storage`,
  `setup`, `authSessions`, `profiles`, `profileSettings`). Put new queries
  there; the old `models.ts` no longer exists.
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
- **Frontend tests** live next to the code as `packages/frontend/src/**/*.test.ts(x)` and run with **Vitest** (`pnpm frontend:test`) in a Node environment; `vitest.config.ts` provides the `@/` alias. Do not assume a browser DOM: mock `Audio`, `AudioContext` and other browser globals explicitly. Component tests opt into jsdom with `/** @vitest-environment jsdom */` and use `src/test/render.tsx` (`renderWithProviders`, which supplies i18n and TanStack Query). Current coverage targets the browser audio deck state machine, the player report buffer, profile-scoped query keys/cleanup, catalog-sync invalidation, the error boundary/404 and card interaction semantics. Add a regression test with every player, cache or component fix; CI runs `pnpm --filter frontend test`.

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
- The handshake requires the `sonect_session` cookie. A missing or invalid token
  closes the socket with **4401**; a `?sessionId=` query that disagrees with the
  authenticated profile closes it with **4403**.
- On client connect: server immediately sends the authenticated profile's
  player status.
- Subsequent updates are pushed from `PlayerRouter`'s `stateChanged` events for
  that profile.
- Library sync/log events still go through `broadcast.ts` (`ws/broadcast.ts`) to
  all connected clients; playback status is per-profile and never global.
- All WS messages follow a standard format with a `type` field: `"player-status"`, `"player-report"` (client → server), `"sync-progress"`, `"sync-complete"`, `"sync-error"`, or `"log"`.

### Authentication and roles

- **Data model.** `profiles` has `password_hash`, `role` (`admin` | `user`,
  default `user`) and `password_updated_at`. `auth_sessions` stores only the
  SHA-256 hash of an opaque 32-byte base64url token, with `profile_id` FK
  `ON DELETE CASCADE`, `created_at`, `expires_at` (30 days, absolute — not
  sliding), `last_used_at` (touched at most every 5 minutes), and
  `user_agent`/`device_id`. Expired rows are pruned at startup.
- **No default profile.** `ensureDefault()` and the default-profile bootstrap are
  gone. The first administrator is created through `POST /auth/bootstrap`
  (`{name,password}`; 409 once an admin exists), which also sets the session
  cookie. The frontend wizard runs `admin → storage → audio → sync`; the admin
  step appears only while `/auth/state` reports `bootstrapRequired`. Backend
  `getSetupProgress()` still reports only `storage`/`audio`/`sync`; the admin
  step is not a `setup_progress` row.
- **Service.** `AuthServiceImpl` (`services/auth/authService.ts`) issues 30-day
  sessions, validates them through `authSessionsDb.findValid`, and supports
  login, logout, switch, self-service password change, and admin reset.
  Passwords use scrypt (`N=16384, r=8, p=1`, 64-byte key) with a valid-format
  check on verification. `LoginThrottle` blocks a profile for 15 minutes after
  5 failed attempts within a 15-minute window and returns 429 with `Retry-After`.
- **Middleware.** `authenticate` (`middleware/auth.ts`) resolves the cookie and
  populates `req.auth`; `requireAuth` returns 401 without a session;
  `requireAdmin` returns 403 for non-admins. `req.auth.profileId` is the only
  trusted identity. `X-Session-Id` is optional and never trusted — if present
  and different from `req.auth.profileId`, `sessionIdMiddleware` rejects it with
  403; `X-Device-Id` remains the output-target hint.
- **Routes.** Public: `GET /health`, `GET /auth/state`, `GET /auth/profiles`,
  `POST /auth/bootstrap` (only while no admin exists), `POST /auth/login`.
  Authenticated: `/auth/logout|switch|password`,
  `/catalog/*` (except scan), `/playlists/*`, `/player/*`,
  `/dashboard`, `/covers`, `/stream`, `/waveforms`. Admin-only: every other
  `/system/*` route, all of `/profiles/*`, and `POST /catalog/scan`.
- **Roles.** Admins own libraries, audio output, sync/scan, debug/setup, and
  profile management. Users can browse and listen, use their own playlists,
  and change their own password. Settings is an admin-only entry in the
  sidebar (hidden for non-admins; `AdminGuard` protects every `/settings/*`
  route).
  The API enforces the same split. The last admin cannot be demoted or deleted
  (409).
- **Cookie.** `sonect_session`: httpOnly, SameSite=Lax, Path=/, 30-day absolute
  `maxAge`, and `Secure` only when `COOKIE_SECURE=true`. CORS uses an exact
  origin allowlist from `CORS_ORIGIN` (comma-separated; empty means same-origin
  only); credentialed requests from another origin need both
  `credentials: "include"` and a matching allowlist entry. `frontend/lib/api.ts` sends credentials and emits
  `sonect:unauthorized` on 401.
- **Sessions and role changes.** Login/switch issue a new cookie; logout deletes
  that token only. A user changing their own password deletes the profile's
  other sessions (the current one stays valid). An admin reset deletes all of the
  target profile's sessions; deleting a profile cascades its sessions.
- **Profile switching.** Requires the destination profile's password. The
  current token is deleted and the old cookie replaced; if the previous profile
  has no active sessions left, its MPD lock is released.
- **MPD lock.** Still keyed by profile id, not device. Logout/switch release it
  when the profile has no active sessions; admin password reset and profile
  delete release it immediately.
- **Frontend identity.** `AuthProvider`/`useAuth` are the only identity source;
  `AuthGuard` redirects unauthenticated users to `/login` and forces `/setup`
  while bootstrap is required; `AdminGuard` protects `/settings`.
  `lib/selectedProfile.ts`, `lib/session.ts`, and
  `ProfileProvider`/`ProfileGuard`/`useProfile` were removed.
  `components/ws-provider.tsx` builds the socket from the authenticated profile.

### Unified per-session playback (`/player`)

`/player` is the **single** playback API (`routes/unifiedPlayerRoutes.ts`, controllers in `controllers/unifiedPlayerController.ts`). Every request requires the `sonect_session` cookie (`requireAuth` → 401) and passes through `sessionIdMiddleware`, which sets `req.sessionId = req.auth.profileId` and `req.deviceId` from the optional `X-Device-Id` header (`localStorage['sonect.deviceId']`). An `X-Session-Id` header is accepted only when it matches the authenticated profile (403 otherwise) and is never the identity source. The WS URL carries `?sessionId=&deviceId=`. There is **no frontend fork** between browser/MPD — `features/player/api.ts` calls only `/player/*`; the backend decides per session.

- **Session identity** — the authenticated profile (`req.auth.profileId`) is the queue owner. `AuthProvider`/`useAuth` supplies it; `lib/deviceId.ts` generates a per-browser random id sent as `X-Device-Id`/`?deviceId=`. Profile = queue owner; device = output target.
- **PlayerRouter** (`services/player/playerRouter.ts`) — `Map<profileId, {mode, engine, activeDeviceId, volume}>` singleton. `mode` is per-profile (`browser` default, `mpd` requires lock). `engine` is `SessionPlayer` wrapper or `MpdAdapter`. `activeDeviceId` is per-profile for `browser` mode (which browser device renders audio); `mpd` mode has `null`. Browser `PUT /player/output-mode {mode:'browser'}` with `X-Device-Id` hands off same `file+elapsed+state` to new device (no engine recreation), emits `stateChanged`. `reportPlayback()` accepts facts only from the active browser device (and claims it when unclaimed); `releaseActiveDevice()` clears the claim and pauses when that device's WS closes. `setVolume` is stored per-profile for browser (remote volumes affect shared state) vs delegated to MPD. `getStatus()` merges `engine.getStatus()` + `volume` + `activeDeviceId` + `mode`.
- **Browser engine (shared per-profile)** — `SessionPlayer` (`services/session/sessionPlayer.ts`) per `SessionRegistry` (`services/session/sessionRegistry.ts` 30m idle sweep): single queue per profile, **no free-running clock**. The active browser sends `player-report` facts (`playing`/`paused`/`waiting`/`ended`/`advance` + elapsed); `SessionPlayer.reportPlayback()` mirrors them, so buffering freezes progress and playback only advances when the browser says so. `playTrack` queues through end of album then appends a smart autoplay batch; `advance` refills when <5 tracks remain. `getStatus()` exposes `nextTrackId` (for preload), `buffering`, a monotonic `seekSeq` (remote seeks only), and an immutable **`epoch`** (UUID per `SessionPlayer` instance) plus a **`revision`** bumped on every `stateChanged`. Reports carry the client's `epoch`; the server ignores reports from another epoch and fences `advance`/`ended` by `fromTrackId`, so an in-flight transition cannot advance a queue that a newer play command replaced. The browser uses two audio decks: the active one plays, the standby preloads `nextTrackId`; on `ended` it promotes the standby and reports `advance`, falling back to `ended` when nothing is preloaded. With a positive crossfade the decks are routed through Web Audio gain nodes and the standby starts before the current track ends. First `play` from a browser device auto-claims `activeDeviceId` if `null` (`setActiveDeviceIfUnclaimed`). Subsequent remote controls (play/pause/seek/volume) from passive devices mutate shared state but keep `activeDeviceId`. `SessionPlayer` mirrors MPD's random/repeat/single semantics through `PlayOrder` (`services/session/playOrder.ts`): `random` puts the current track first, shuffles the rest and inserts later queue additions into the remaining order; `repeatMode` is `off`/`all`/`one` with reshuffling at each repeat-all pass; `nextTrackId` returns the current id for repeat-one so the browser restarts the same track. Each `SessionPlayer` owns its own `AutoplayService` instance (no global singleton).
- **MPD engine (shared, single-owner)** — `MpdAdapter` wraps `PlayerServiceImpl` + `MpdConnectionManager`. Shared global queue/daemon. `resume` uses explicit `pause 0`. Lock via `MpdConfigService.tryAcquireMpd(profileId)` (`services/mpd/mpdConfigService.ts`); `PUT /player/output-mode {mode:'mpd'}` returns 423 if another profile owns MPD. `mpd→browser` handoff sets `activeDeviceId` to requesting device. `GET /player/output-mode` returns `deviceName`, the friendly name of the configured audio device (the detected device description, falling back to the name stored in the MPD drop-in). The frontend labels that output **Speakers** and shows `deviceName` as its subtitle; "MPD" is never user-visible (only logs and technical docs).
- **WebSocket** — `ws/player.ws.ts` authenticates the handshake cookie (4401 if missing/invalid, 4403 if `?sessionId=` mismatches) and resolves `PlayerRouter.getStatus(profileId)` + `on("stateChanged")` for that profile, sending `{type:'player-status', ...status, activeDeviceId, mode}`. Inbound `{type:'player-report', ...}` messages are validated with `playerSchemas.report` (including `epoch` and `fromTrackId`) and forwarded to `PlayerRouter.reportPlayback(profileId, deviceId, report)`; only the active device is accepted. On close the active device is released. Mutating `/player/*` commands return the authoritative `PlaybackStatus`; the initiating tab applies it immediately and `PlaybackContext.applyPlaybackStatus` dedupes `(epoch, revision)` against the WS copy. Router-owned fields (`activeDevice*`, `mode`) bypass that dedupe (`applyRouterStatus`) because browser handoff/release changes them without an engine revision bump. `PlaybackStatus.error` carries the current MPD status error when present, and the player renders it as a localized warning. The legacy unauthenticated MPD-only path is gone. Frontend `components/ws-provider.tsx` appends `&sessionId=&deviceId=` from `useAuth`, exposes `usePlayerSocket().sendReport`, and applies the whole `player-status` (including `activeDevice*` and `mode`) to `PlaybackContext`; `activeDeviceId`, `activeDeviceName`, `activeDeviceType` and `trackPlayed` are derived from that single status object. `features/player/player-engine-context.tsx` only calls the browser engine's `play()` when `outputMode==='browser' && (activeDeviceId===null || activeDeviceId===myDeviceId)`.
- **Crossfade per profile** — `profile_settings.crossfade_seconds` (0–30,
  default 0) is edited from Settings → Playback (admin-only; it edits the
  signed-in profile's value) and exposed as `PlaybackStatus.crossfade` in every
  status. Browser sessions apply it with Web Audio gain ramps between the
  active and standby decks; MPD sessions apply the owner profile's value with
  the native `crossfade` command on acquire, on change while owning the lock,
  and on MPD reconnect. MPD can only crossfade tracks with the same audio
  format. There is no gap setting (MPD has no native gap between tracks).
- **Streaming** — browser audio uses `GET /stream/:trackId` (`controllers/streamController.ts`). The controller resolves the track via `tracksDb.getById` and streams `MUSIC_DIR/track.file`, so filenames never appear in URLs (no special-character encoding issues). It streams progressively with HTTP Range (`start-end`, `start-`, `-suffix`), `HEAD`, `ETag`/`Last-Modified`, `If-Range`, `Cache-Control: private, max-age=3600`, and destroys the read stream when the client aborts. Never buffer the file in memory.
- **Legacy routes** — `/mpd`, `/session`, `/system/status`, `/system/network/status`, `/system/output-mode`, `/system/storage/mounts`, and `GET /system/storage/sources/:id` were removed. Vite proxies the API prefixes in `frontend/vite.config.ts`.
- **Autoplay in sessions** — browser sessions now reuse the same smart-autoplay batches as MPD but per-profile (one `AutoplayService` per `SessionPlayer`); MPD still uses the singleton via `factory.ts` + `MpdConnectionManager` callback.

### Liked songs

- **Per profile, not global.** `liked_tracks` (`profile_id`, `track_id`, `liked_at`) has a unique `(profile_id, track_id)` constraint and cascades on profile/track delete. `likedDb` (`packages/db/src/repositories/liked.ts`) owns `add`/`remove`/`list`/`ids`/`files`/`summary`.
- **API** (`routes/likedRoutes.ts`, `controllers/likedController.ts`, `services/library/likedService.ts`): `GET /likes` (`items,total,totalDuration,qualities`; optional `quality=bits:rate` and `sort=recent|quality-desc|quality-asc`), `GET /likes/ids`, `PUT /likes/:trackId`, `DELETE /likes/:trackId`, `POST /likes/play` (`{shuffle?, quality?, sort?}`). A quality key uses `bits:rate` with an empty side for a null value (`24:`, `:48000`); a bare `:` is rejected. `qualities` always lists every non-empty quality among the profile's likes, independent of the active filter. All require the session cookie; `PUT` returns 404 for unknown tracks and is idempotent. `/likes` must stay in `app.ts` (auth paths + SPA fallback) and the Vite proxy. Liked Songs is a tab inside Discover (`/discover`), and legacy `/home/liked` redirects there with `state.tab = "liked"`; the API prefix is `/likes` to avoid the direct-navigation collision.
- **Hearts are always visible**, not hover/context-menu actions. The shared `features/liked/components/like-button.tsx` uses the per-profile ids query, optimistic add/remove, and rollback + toast on failure. It appears on album/genre/playlist rows, search results, queue rows, full-page now-playing, dashboard track cards, and the Liked Songs page.
- **Liked Songs page** (`pages/LikedSongs.tsx`, Discover tab) is an infinite list ordered newest-like-first with Play All/Shuffle. It can filter/sort by track quality server-side; the filtered count, duration, Play All and Shuffle all use the filtered/sorted set, and an empty result shows a clear-filter state rather than the "no likes" state. Playback uses `POST /likes/play`, which resolves liked files server-side and calls `playFiles(files, startAt)` on the active engine (`SessionPlayer.playFiles` / `PlayerServiceImpl.playFiles`). This replaces the removed flat Tracks page; `/tracks` and the legacy `/liked` redirect to `/discover` with the Liked Songs tab.
- **Queue hearts** rely on `QueuedTrack.trackId` (the DB id); `QueuedTrack.id` is a file hash in MPD mode. Do not use `id` for likes.
- **Query keys** are profile-scoped (`qk.liked.ids(profileId)`, `qk.liked.list(profileId, quality, sort)`) so switching profiles cannot leak another profile's likes; the quality/sort params keep a filtered list from reusing another filter's cached pages.

### Dashboard and play history (per profile)

- **`play_history` is the dashboard source of truth.** It stores one row per
  track start: `profile_id`, `track_id`, `played_at` (epoch ms), both FKs
  `ON DELETE CASCADE`, indexed by `(profile_id, played_at)` and
  `(profile_id, track_id)`. `playHistoryDb`
  (`packages/db/src/repositories/playHistory.ts`) owns the per-profile
  aggregates: recent tracks/albums/artists, top tracks/genres/artists, top
  genre, and discovery (`< 3` plays for that profile).
- **Recording.** `PlayerRouter` emits `trackChanged {sessionId, track}` for both
  engines: `SessionPlayer` emits on real queue-track changes (not every report),
  and `MpdAdapter` forwards the MPD manager's `trackChanged`. `PlayTrackingService`
  receives the router event, writes `play_history` for `sessionId` (the
  authenticated profile), and still updates the global `tracks.play_count` /
  `albums.last_played` that autoplay ranking uses. Debounce is 5s per
  profile+track. MPD plays are attributed to the profile that holds the MPD
  lock; browser plays to their profile's `SessionPlayer`.
- **API.** `GET /dashboard` requires auth and passes `req.auth.profileId` to
  `SuggestionService.getDashboard(profileId, excludeAlbumId?)`. All sections
  (recent albums/artists/tracks, top tracks, suggestions, genre mix) are
  profile-scoped. With no history, recent/top are empty; suggestions fall back
  to random library tracks and the mix to the library's most-populated genre.
- **Frontend cache** uses `qk.dashboard(profileId)`; login/profile switch
  removes the dashboard cache. Never key dashboard data globally.
- Existing pre-`play_history` global play counts are **not** attributed to a
  profile; per-profile dashboards start empty and fill from the next plays.

### Cover art pipeline

1. `coverSyncService.ts` (`services/library/coverSyncService.ts`) handles cover extraction using `music-metadata` for embedded art.
2. Filesystem covers (`cover.jpg`, `folder.jpg`, etc.) are checked first; embedded art is used as fallback. Covers are resized to **400×400 WebP** (`COVER_SIZE`/`COVER_QUALITY` envs) with `sharp`, saved to `COVERS_DIR` as `SHA1(artist+album).webp` (legacy `.jpg` auto-migrated on next sync).
3. Backend serves them under `/covers` with `Cache-Control: immutable` (30 days).

### Waveform pipeline (SoundCloud-style progress bar)

1. `waveformService.ts` (`services/library/waveformService.ts`) generates per-track waveforms on demand. It decodes audio via `ffmpeg` (`-f s16le -ac 1 -ar 8000`) and computes **120** normalized peaks (`0–255`) by `max(|sample|)/32768` per bin, scaling max to 255 for contrast — mirroring Monochrome's `waveform.js:168` `extractPeaks` (4 peaks/sec, capped 1000). If `ffmpeg` is missing or decode fails, a deterministic fallback envelope is used so the UI never shows a flat line.
2. Waveforms are cached as `SHA1(file).json` under `WAVEFORMS_DIR` (`{samples, duration, version:1}`) with atomic write + an in-memory `Map` (volatile, not an LRU) + request coalescing (`pendingGeneration` map). Served via `GET /waveforms/:trackId` (`routes/waveformRoutes.ts`, `controllers/waveformController.ts`) with `Cache-Control: immutable` (86400s). `Vite` proxy forwards `/waveforms` (`frontend/vite.config.ts`).
3. Frontend `components/waveform.tsx` renders a **canvas** SoundCloud-style bar waveform: `numBars=min(samples, floor(width/3))`, `barWidth=0.65*slot`, `gap=0.35*slot`, rounded `barHeight=max(2, peak*height*0.82)`, centered vertically. Played vs unplayed are two clipped fills (`--primary` vs `--muted-foreground` at 35% opacity) driven by `elapsed/duration` progress. `PlaybackWaveform` (`features/player/components/playback-waveform.tsx`) fetches via `playerQueries.waveform(trackId)` (`lib/queryKeys.ts: qk.player.waveform`, 5m stale/30m gc), renders the **20px waveform track** (`h-5`) wrapped in a Radix slider (click-to-seek + a11y) and falls back to a 6px progress bar (`h-1.5`) when no waveform data is available. `music-player.tsx` (desktop compact bar) and `full-page-player.tsx` (mobile `/player`) both pass `trackId={track?.id}` and use the waveform slider; the old mobile `PlaybackProgressBar` was removed. Responsive at 375/768/1280 via `ResizeObserver` + Tailwind.

### First-run setup wizard

- Route: `/setup` (`pages/SetupWizard.tsx`), wrapped by `AuthGuard`. `SetupGuard`
  (`components/setup-guard.tsx`) sits inside `MainLayout` around the routed page
  content: only admins are checked, and the first check in each browser-tab
  session calls `GET /system/setup/progress`, caches the backend `complete`
  result in `sessionStorage["setup-complete"]`, and redirects to `/setup` when it
  is false. Later checks in that tab use the cached backend result. Regular
  users skip setup entirely and go straight to the app.
- **Admin step first.** With no administrator in `profiles`, `/auth/state`
  reports `bootstrapRequired`, `AuthGuard` forces `/setup`, and the wizard's
  first step creates the admin through `POST /auth/bootstrap` (name + password,
  ≥ 8 characters), which also sets the session cookie. There is no default
  profile; `ensureDefault()` has been removed. Skip is hidden until an admin
  exists.
- The gate is **not** "all steps done": setup is considered complete only when a permanent done flag is set. The flag is a pseudo-step `complete` in the `setup_progress` table and is written by the explicit `POST /system/setup/complete` endpoint (the only intended writer), used by both Skip and Finish; the endpoint accepts any non-empty step name, so the invariant is by convention, not enforced. Updating an individual step or creating a storage source does not set it. `isSetupComplete()` does **not** consider existing storage sources — the stored `complete` flag is the single source of truth.
- `getSetupProgress()` (`services/system/setupService.ts`) reports steps in order `["storage", "audio", "sync"]`; the `storage` step's `completed` flag is **derived** from `storageDb.getAll().length > 0` (not stored), while `audio`/`sync` flags come from `setup_progress` rows. The admin step is not part of this list.
- Frontend wizard steps: Admin (only while `bootstrapRequired`) → Storage → Audio → Sync; a returning admin starts at Storage.
- The Storage step shares components with Settings → Libraries: detected (unregistered) folders render as one-click **Add** rows (`DetectedLibraryRow`), an "Or add manually" form covers manual paths, and the success dialog shows the created library with `LibraryStats`. When at least one library is already registered the footer also shows **Continue**, so a re-run (after a setup reset) can never get stuck; with zero libraries, create remains required.
- Skip is persisted by the backend, so it applies to normal and private/incognito browser sessions. `sessionStorage["setup-complete"]` is only a per-tab cache of a confirmed backend result, not a local skip flag. `POST /system/setup/reset` (admin-only; also exposed as the "Reset setup wizard" button in Settings → Debug) clears every `setup_progress` flag, invalidates the current tab's cache, and reloads without touching `storage_sources` or profiles. A reset performed by another tab is observed when a new tab session starts.

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
`GET /health` (interval 30s, start-period 30s), a dependency-free Express route
that only confirms the HTTP server is answering. s6 restarts crashed longruns
internally; the HEALTHCHECK only reports status (it does not trigger restarts
under `restart: unless-stopped`).

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
  Creating or deleting a source, or updating its `path`, triggers
  `scanLibrary({ force: true })` (which owns the MPD `update`); name/enabled-only
  edits do not rescan. `createStorageSource` is **async**: it computes initial
  stats with the non-blocking `computeSourceStatsAsync` walk and **persists** them
  via `storageDb.updateStats` before returning, so a fresh library never reads
  0/0/0 while the first MPD sync runs (the sync then replaces `file_count` with
  the catalog count). The `storage_sources` table has no
  `type`/`uri`/`mount_path`/`username`/`password` columns.
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
- Per-source stats are persisted on `storage_sources`:
  - `file_count` is the **catalog count** for tracks attributed to the source
    (`tracks.storage_source_id`), so it matches what Sonect actually shows.
  - `dir_count` / `total_size` come from a **lightweight filesystem walk**
    (`storageStats.computeSourceStatsAsync`) because MPD exposes neither per
    directory.
  - `LibraryStatsService` refreshes only the sources reported as changed by the
    catalog sync; the first MPD sync and manual refreshes cover all sources.
- `MUSIC_EXTENSIONS` (comma-separated; default
  `mp3,flac,ogg,oga,opus,m4a,aac,wav,wma,ape,wv,dsf,dff,mpc,tta`) selects which
  audio extensions the stats walk counts as music files.
- `GET /system/storage/sources` annotates each row with `available`/`error`
  (`statSync` + read access). The admin-only status center surfaces an
  unavailable folder as an error; the check is a point-in-time view refreshed
  with the status-center poll.

### Library sync progress

`CatalogSyncOrchestrator.scanLibrary()` broadcasts `sync-progress` phases:

1. `scan-started` — request accepted.
2. `mpd` — MPD `update` is running; the orchestrator polls `status.updating_db`.
3. `tracks` — MPD records are read in `find` pages and diffed; each message
   carries `current`/`total` and the current track's `title`/`artist`/`album`
   (throttled), so the sync card shows song names while importing.
4. `covers` — album cover backfill, `current`/`total` albums.
5. `sync-complete` / `sync-error`.

**Frontend sync UI.** There is no top-bar sync widget and no sidebar refresh
icon. Admins start a scan from the permanent **Library sync** card at the top of
Settings → Libraries (`features/sync/components/sync-card.tsx`); the sidebar
status center (`features/status/`) shows the running phase to everyone and
offers **Sync now** to admins, while on mobile an activity pill opens the same
details in a bottom sheet. `SyncProgressView` renders the 3 steps (MPD / tracks
/ covers) with an
indeterminate bar until counts exist, the current item, and `current/total`.
`syncError` in `PlaybackContext` carries `sync-error.message` (it is cleared by
the next `sync-progress`/`sync-complete`), so an error never renders as success.
`WebSocketProvider` invalidates TanStack queries once per phase: when `tracks`
reaches `total` or `covers` starts it invalidates `qk.catalog.root()` +
`qk.dashboardRoot()`, and on `sync-complete` it also invalidates
`qk.system.storageSources()` + `qk.system.detectedLibraries()`. The backend
catalog write remains atomic, so the lists populate after MPD has been fully
read, not while it is being read.

MPD's log file is **not** read for progress (it has no built-in rotation and the
format is not a stable API); the MPD protocol is the source. If MPD is
unreachable, the sync fails before any catalog write and the previous library is
kept. If MPD reports zero songs while a registered library still contains audio
files, the sync aborts and keeps the catalog (guards against an unmounted
share).

Non-UTF-8 share names remain a share-level concern: fix the mount charset or
rename through a UTF-8 client. The stats walk skips unreadable/non-UTF-8 entries
and reports the walked subset; Sonect never renames files.

## What NOT to do

- Do not parse audio files with `music-metadata` for sample rate/bit depth; MPD's `Format` is the catalog source. It is a decoder approximation for lossy files, so display it as reported rather than labelling it lossless/hi-res.
- Do not add a free-running timer clock for browser playback. In browser mode the active browser is the source of truth; the backend only mirrors `player-report` facts. MPD mode stays MPD-authoritative and does not need a connected browser.
- Do not add a "gap between tracks" setting for MPD: MPD has no native gap (only crossfade).
- All MPD communication must go through `MpdConnectionManager` (`executeCommand`/`executeCommandList`/`getCachedStatus`). Do not create additional MPD connections.
- Do not introduce privileged operations in the backend — no `mount`/`umount`, no `systemctl`, no `sudo`. Storage is host-provided (bind mounts) and MPD is reloaded by the backend's supervisor hook when its drop-in changes.
- Do not add new environment variables without documenting them here and in `README.md`.
- Do not commit `node_modules`, `dist/`, or `.env` files.
- Do not modify `pnpm-lock.yaml` manually.
- Do not add console.log debug statements in production paths.
- Do not tail `mpd.log` (or add log rotation) for sync progress — use the MPD protocol.
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
