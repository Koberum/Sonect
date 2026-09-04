# Sonect Dev Container

This dev container provides a complete development environment for the Sonect project using the same Debian Bookworm base as Raspberry Pi OS.

## Features

- **OS**: Debian Bookworm (same as Raspberry Pi OS)
- **Node.js**: Version 20
- **Package Manager**: pnpm
- **Audio Support**: MPD (Music Player Daemon), ALSA utilities
- **Full Workspace**: Access to all packages in the monorepo

## What's Included

- MPD server for audio streaming
- ALSA audio utilities
- Complete Node.js development environment
- All necessary build tools
- Git for version control

## Ports

- **3000**: Backend API server
- **5173**: Frontend Vite development server
- **6600**: MPD server

## Usage

### Opening the Dev Container

1. Install the "Dev Containers" extension in VS Code
2. Open the Command Palette (Ctrl+Shift+P / Cmd+Shift+P)
3. Select "Dev Containers: Reopen in Container"
4. Wait for the container to build and start

### Running the Project

Once inside the container:

```bash
# Install dependencies (done automatically via postCreateCommand)
pnpm install

# Run frontend and backend in parallel
pnpm dev

# Or run them separately:
pnpm frontend:dev   # Start frontend on port 5173
pnpm backend:dev    # Start backend on port 3000

# Build all packages
pnpm build
```

### Testing MPD

The MPD server is installed and configured. You can test it with:

```bash
# Start MPD (if not already running)
mpd /etc/mpd.conf

# Check MPD status
mpc status
```

`/etc/mpd.conf` is a minimal boilerplate config that `include`s the
user-editable drop-in at `/opt/sonect/data/mpd-audio.conf` — the same
two-file architecture that `installer.sh` sets up on a Raspberry Pi. The
backend writes the drop-in (via `MPD_CONFIG_PATH`, default
`/opt/sonect/data/mpd-audio.conf`) as the service user, so frontend audio
and MPD-config edits behave exactly as they do in production.

The Compose mount at `/etc/mpd.conf` is the main configuration and must not be
overwritten by `postCreate.sh`. The post-create hook only creates the separate
drop-in file. This prevents the main configuration from including itself
recursively.

## Volume Mounts

- `/workspace`: Your entire project
- `/music`: Music library directory
- `/etc/mpd.conf`: MPD configuration (bind-mounted from `conf/mpd.conf`)
- `/var/lib/mpd`: MPD data directory
- `/dev/snd`: Host audio devices (for local testing)
- `/opt/sonect/data/mpd-audio.conf`: User-editable MPD drop-in included by `/etc/mpd.conf` (created by `postCreate.sh` and written by the backend)

## Testing on Raspberry Pi

Since this container uses the same OS (Debian Bookworm) as Raspberry Pi OS, you can:

1. Develop and test all features in the container
2. Be confident that it will work the same way on your Raspberry Pi
3. Test audio functionality with ALSA/MPD
4. Debug platform-specific issues before deploying

## Notes

- The container runs with `privileged: true` to access audio devices
- The `remoteUser` is set to `node` for security
- All pnpm commands work across the entire monorepo
