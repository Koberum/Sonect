# Sonect

[![CI](https://github.com/Koberum/Sonect/actions/workflows/ci.yml/badge.svg)](https://github.com/Koberum/Sonect/actions/workflows/ci.yml)
[![Release](https://github.com/Koberum/Sonect/actions/workflows/release.yml/badge.svg)](https://github.com/Koberum/Sonect/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A self-hosted music streaming application powered by [Music Player Daemon (MPD)](https://www.musicpd.org/). Browse your music library, control playback, and manage albums and artists through a modern React interface.

## Features

- Browse music library by artist, album, and track
- Real-time playback control via MPD
- Album artwork extraction and serving with browser caching
- Smart queue management (album → artist → genre strategy)
- Playback modes: repeat, random, consume, single
- Dark / light theme
- Internationalization (i18n) support
- WebSocket-driven live playback state updates
- Audio output configuration and MPD config editing via the Settings page

## Architecture

```
sonect/
├── packages/
│   ├── backend/       # Express 5 API server + WebSocket server (port 3000)
│   ├── frontend/      # React 19 + Vite SPA (port 5173)
│   ├── db/            # SQLite database layer
│   └── types/         # Shared TypeScript types
├── music/             # Mount point for your music files
├── data/              # MPD state, sticker DB, tag cache, playlists
└── conf/              # MPD configuration
```

### Request flow

```
Browser ──HTTP──► Express API ──► MPD (port 6600)
        ──WS───► WebSocket server ──► MPD idle listener
```

## Requirements

- Node.js 20+
- pnpm 9+
- A running MPD instance

## Getting Started

```bash
# Install dependencies
pnpm install

# Start everything in development mode
pnpm dev

# Or start services individually
pnpm frontend:dev   # React dev server on :5173
pnpm backend:dev    # Express API on :3000
```

### Environment variables

Create a `.env` file in `packages/backend/`:

| Variable          | Default                           | Description                               |
| ----------------- | --------------------------------- | ----------------------------------------- |
| `MPD_HOST`        | `localhost`                       | MPD server hostname or IP                 |
| `MPD_PORT`        | `6600`                            | MPD server port                           |
| `MUSIC_DIR`       | `/music`                          | Root directory of the music library       |
| `COVERS_DIR`      | —                                 | Path where cover JPEGs are saved          |
| `DB_PATH`         | `./data/music.db`                 | SQLite database file path                 |
| `MPD_CONFIG_PATH` | `/opt/sonect/data/mpd-audio.conf` | User-editable MPD config drop-in          |
| `MPD_LOG_PATH`    | `/var/lib/mpd/mpd.log`            | MPD log file (for per-file sync progress) |
| `PORT`            | `3000`                            | Backend HTTP server port                  |
| `FRONTEND_DIST`   | `../frontend/dist`                | Path to built frontend static files       |

### MPD configuration

Sonect uses an `include` directive to separate concerns:

- **`/etc/mpd.conf`** — root-owned boilerplate (music_directory, bind_to_address, port, log_file)
- **`/opt/sonect/data/mpd-audio.conf`** — service-user-owned drop-in for all user-editable settings

Audio output and advanced MPD config are edited from the Settings page in the web UI.
When you click Save, the drop-in is written and MPD is restarted automatically.

**The `log_file` directive is required** for real-time per-file progress during library sync.
The installer adds `log_file "/var/lib/mpd/mpd.log"` to `/etc/mpd.conf` automatically.
If you manually configure MPD, ensure a `log_file` is set and readable by the backend process.

## API Overview

| Method | Path                          | Description              |
| ------ | ----------------------------- | ------------------------ |
| GET    | `/library/albums`             | List all albums          |
| GET    | `/library/albums/:id`         | Get album by ID          |
| GET    | `/library/albums/:id/tracks`  | Tracks for an album      |
| GET    | `/library/artists`            | List all artists         |
| GET    | `/library/artists/:id/albums` | Albums for an artist     |
| POST   | `/library/scan`               | Trigger library re-scan  |
| POST   | `/mpd/play`                   | Play a track             |
| POST   | `/mpd/pause`                  | Toggle pause             |
| POST   | `/mpd/next` / `/mpd/previous` | Skip track               |
| PATCH  | `/mpd/volume`                 | Set volume (0–100)       |
| GET    | `ws://…`                      | WebSocket playback state |

## Build & Deploy

```bash
# Build all packages
pnpm build
```

### Releases

- Version numbers follow [SemVer](https://semver.org) and are managed by
  [release-please](https://github.com/googleapis/release-please): merge
  Conventional Commit messages to `main` (`feat:`, `fix:`, `chore:`, …) and a
  Release PR bumps the version in `CHANGELOG.md`, then a tagged GitHub release
  (`v1.2.3`) is published with a single `sonect.tar.gz` asset.
- CI (`ci.yml`) runs lint, build, and the backend test suite as a mandatory
  gate on every PR/push to `main`.

### Installing / updating on a Raspberry Pi

No GitHub token is required:

```bash
sudo bash installer.sh
```

The installer downloads the latest public release asset
(`https://github.com/Koberum/Sonect/releases/latest/download/sonect.tar.gz`),
preserves your database and MPD config, and restarts the service. To pin a
specific version, download `…/releases/download/vX.Y.Z/sonect.tar.gz` yourself
and run the installer steps for extracting it (or re-run `installer.sh`). The
running version is reported by `GET /system/status` as `version`.

## Roadmap

- [ ] Library Settings – directory management
- [ ] Search function
- [ ] Albums section view
- [ ] Genre section
- [ ] Improve artwork creation pipeline
