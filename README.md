<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Koberum/Sonect/main/packages/frontend/public/sonect-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Koberum/Sonect/main/packages/frontend/public/sonect-logo-light.svg">
    <img src="https://raw.githubusercontent.com/Koberum/Sonect/main/packages/frontend/public/sonect-logo-light.svg" alt="Sonect" width="420">
  </picture>
</p>

<p align="center">
  <em>Self-hosted music streaming, powered by <a href="https://www.musicpd.org/">Music Player Daemon</a>.</em>
</p>

<p align="center">
  <a href="https://sonect.dev"><img alt="Website" src="https://img.shields.io/badge/sonect.dev-Website-orange?style=flat-square"></a>
  <a href="https://github.com/Koberum/Sonect/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Koberum/Sonect/actions/workflows/ci.yml/badge.svg?style=flat-square"></a>
  <a href="https://github.com/Koberum/Sonect/actions/workflows/release.yml"><img alt="Release" src="https://github.com/Koberum/Sonect/actions/workflows/release.yml/badge.svg?style=flat-square"></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-lightgrey"></a>
</p>

---

Sonect wraps MPD in a modern React interface. Browse your library by album,
artist, or genre, control playback in real time, and never depend on a
streaming service again. Everything runs on your own hardware — no telemetry,
no subscriptions, no limits.

---

## Features

- **MPD-powered playback** — Gapless, battle-tested, supports virtually any
  audio format. Repeat, random, consume, and single modes are all first-class.
- **Live WebSocket state** — Playback changes reflect instantly across every
  open tab. MPD idle events are pushed to all connected clients in real time.
- **Always-on smart queue** — Playback continues from the selected track to
  the end of its album, then queues complete albums from the same artist, the
  same genre, and finally the most-listened albums across the library.
- **Album art pipeline** — Artwork is extracted from your audio files, resized
  to 500x500 JPEG, served over HTTP, and cached in the browser for 30 days.
- **In-browser MPD config** — Edit audio outputs and MPD settings from the
  Settings page. Save once, MPD restarts automatically — no SSH needed.
- **One-line Raspberry Pi install** — A single `curl | bash` command turns a
  Pi 2B into a dedicated music appliance. See below.

---

## 3D Printed Case

A custom two-part case designed for the **Raspberry Pi 2B**, turning your Pi
into a compact, self-contained Sonect appliance.

![Sonect 3D case](assets/screenshots/case_v1.png)

| Part     | File                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------ |
| Interior | [`assets/screenshots/stls/sonect_case_interior_v3.stl`](assets/screenshots/stls/sonect_case_interior_v3.stl) |
| Exterior | [`assets/screenshots/stls/sonect_case_exterior_v3.stl`](assets/screenshots/stls/sonect_case_exterior_v3.stl) |

Print in PLA or PETG, supports required.

---

## Quick Start

### Development (local machine)

```bash
git clone https://github.com/Koberum/Sonect
cd Sonect
pnpm install

# Configure your music directory
cat > packages/backend/.env << EOF
MPD_HOST=localhost
MPD_PORT=6600
MUSIC_DIR=/home/you/Music
COVERS_DIR=./data/covers
EOF

# Start everything
pnpm dev
```

Open `http://localhost:5173` and trigger a library scan from the Settings page.

On first launch, the setup wizard guides you through storage, audio, and library
sync. Finishing or skipping the wizard is persisted by the backend, so the
choice applies across browsers and private windows until the wizard is reset
from Settings → Debug.

### Raspberry Pi (production)

```bash
curl -fsSL https://raw.githubusercontent.com/Koberum/Sonect/main/installer.sh | sudo bash
```

This installs Node.js, MPD, and all dependencies, downloads the latest
prebuilt release, creates a systemd service, and starts Sonect on port 3000.
Your music goes in `/opt/sonect/music/`.

---

## Architecture

```
sonect/
├── packages/
│   ├── backend/       Express 5 API + WebSocket server (port 3000)
│   ├── frontend/      React 19 + Vite SPA (port 5173 in dev)
│   ├── @repo/db/      Native SQLite (node:sqlite) + Drizzle repositories
│   └── @repo/types/   Shared TypeScript types (no runtime deps)
├── assets/            Screenshots and 3D print files
├── conf/              MPD configuration
├── data/              MPD state, sticker DB, tag cache, playlists
└── music/             Mount point for your music library
```

```
Browser ──HTTP──► Express API ──► MPD (port 6600)
        ──WS───► WebSocket server ──► MPD idle listener
```

The backend maintains two TCP connections to MPD: a command client for
playback control and a polling client for status updates. The in-memory cache
is refreshed every 2 seconds during play (10 s during pause/stop) and
immediately after user-initiated commands.

The database is native SQLite through Node's built-in `node:sqlite` module,
accessed via a synchronous Drizzle repository layer in `@repo/db` — no WASM
SQLite build ships in the release artifact. Node.js **22.14.0** is the minimum
runtime. The database runs in WAL mode and is checkpointed during graceful
shutdown, so the backup the installer takes before an upgrade always contains
a complete database file.

---

## API Overview

| Method | Path                          | Description              |
| ------ | ----------------------------- | ------------------------ |
| GET    | `/library/albums`             | List all albums          |
| GET    | `/library/albums/:id`         | Get album by ID          |
| GET    | `/library/albums/:id/tracks`  | Tracks for an album      |
| GET    | `/library/artists`            | List all artists         |
| GET    | `/library/artists/:id/albums` | Albums for an artist     |
| POST   | `/library/scan`               | Trigger library re-scan  |
| POST   | `/mpd/play`                   | Play a track or resume   |
| POST   | `/mpd/pause`                  | Toggle pause             |
| POST   | `/mpd/next`                   | Next track               |
| POST   | `/mpd/previous`               | Previous track           |
| PATCH  | `/mpd/volume`                 | Set volume (0–100)       |
| GET    | `/system/setup/progress`      | Read setup progress      |
| POST   | `/system/setup/complete`      | Complete or skip setup   |
| POST   | `/system/setup/reset`         | Reset the setup wizard   |
| GET    | `ws://host:3000`              | WebSocket playback state |

### Environment variables

Configure via `packages/backend/.env`:

| Variable           | Default                                                        | Description                                                         |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------- |
| `MPD_HOST`         | `localhost`                                                    | MPD server hostname or IP                                           |
| `MPD_PORT`         | `6600`                                                         | MPD server port                                                     |
| `MUSIC_DIR`        | `/music`                                                       | Root of your music library                                          |
| `MUSIC_EXTENSIONS` | `mp3,flac,ogg,oga,opus,m4a,aac,wav,wma,ape,wv,dsf,dff,mpc,tta` | Audio extensions counted as music files in per-source library stats |
| `COVERS_DIR`       | —                                                              | Where cover JPEGs are cached                                        |
| `DB_PATH`          | `./data/music.db`                                              | SQLite database path                                                |
| `MPD_CONFIG_PATH`  | `/opt/sonect/data/mpd-audio.conf`                              | MPD config drop-in                                                  |
| `MPD_LOG_PATH`     | `/var/lib/mpd/mpd.log`                                         | MPD log file for sync progress                                      |
| `PORT`             | `3000`                                                         | Backend HTTP port                                                   |
| `FRONTEND_DIST`    | `../frontend/dist`                                             | Built frontend static files                                         |

### Library sources

**Local library sources** are exposed to MPD via a symlink under the music
directory (`/opt/sonect/music/<folder-name>`), created automatically when the
source is created. The MPD drop-in config gets `follow_outside_symlinks "yes"`
so MPD follows the symlink — no OS mount is involved.

Each library source (SMB, NFS, local) shows **file count, folder count, and
total music-file size** in Settings → Libraries, refreshed at the end of every
library scan. `MUSIC_EXTENSIONS` controls which audio extensions are counted as
music files.

---

## Build & Deploy

The monorepo uses [Turborepo](https://turbo.build) for task orchestration:
`build`, `lint`, and `test` are cached — re-running them without changes
finishes in milliseconds (`>>> FULL TURBO`), and only the affected packages
rebuild after an edit. Frontend build caching is keyed on the
`VITE_BACKEND_URL`, `VITE_WEBSOCKET_URL`, `VITE_COVER_PATH`, and `VITE_DEBUG`
environment variables, so changing any of them invalidates the cache.

```bash
pnpm build          # Compile all packages (turbo-cached)
pnpm lint           # Lint all packages (turbo-cached)
pnpm dev            # Run all packages' dev servers in parallel (not cached)
pnpm backend:test   # Run backend tests (fresh run, not cached)
pnpm backend:bundle # Bundle backend for production
pnpm frontend:build # Build frontend for production
pnpm db:generate    # Generate a new SQL migration from the schema (drizzle-kit)
pnpm db:migrate     # Apply pending migrations to the database
pnpm db:migrate-reset [--force] # Wipe the database and re-apply all migrations
pnpm db:studio      # Browse/edit the database in a browser GUI (drizzle-kit)
```

### Database migrations

The SQLite schema is defined in `packages/db/src/tables.ts`. To change it,
edit that file and run `pnpm db:generate`, which commits a versioned SQL
migration under `packages/db/drizzle/`. Migrations are applied automatically
at backend startup and tracked in the `__drizzle_migrations` table.

For manual control, `pnpm db:migrate` applies pending migrations to the
database at `DB_PATH` (default `./data/music.db`) — useful to preview what
startup would do. `pnpm db:migrate-reset` wipes the database (file, WAL and
SHM) and re-applies every migration from scratch; it prompts for
confirmation unless `--force` is passed. `pnpm db:studio` opens drizzle-kit
studio, a browser GUI for inspecting and editing data. Studio browses the
live dev database at `packages/backend/data/music.db` by default; set
`DB_PATH` to point it elsewhere (absolute or repo-root-relative path).

**One-time reset on upgrade:** databases created before the migration system
(any database with our tables but no `__drizzle_migrations` table) are wiped
and rebuilt on first startup. Play counts, playlists, storage sources, and
setup flags are lost — this is a deliberate one-time reset.

### Releases

Versions follow [SemVer](https://semver.org) and are managed by
[release-please](https://github.com/googleapis/release-please). Merge
Conventional Commit messages (`feat:`, `fix:`, `chore:`, …) to `main` and a
Release PR bumps the version, updates `CHANGELOG.md`, and publishes a tagged
release with a single `sonect.tar.gz` asset.

---

## License

[Apache2.0](LICENSE)
