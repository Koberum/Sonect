#!/bin/bash
set -e

echo "🎧 Installing dependencies with pnpm workspace..."

# install for all packages
pnpm install

# Ensure MPD directories exist
mkdir -p /workspace/music /var/lib/mpd/playlists /var/lib/mpd
touch /var/lib/mpd/tag_cache /var/lib/mpd/state /var/lib/mpd/sticker.sql

echo "🎶 Starting MPD in dev mode..."
mpd /etc/mpd.conf || true

echo "✅ Dev container ready"
