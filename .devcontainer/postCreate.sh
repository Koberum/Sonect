#!/bin/bash
set -e

# Create the user-editable MPD drop-in (included by /etc/mpd.conf) so MPD has a
# default audio output in dev. Mirrors what the single `sonect` image does in
# docker (/app/data/mpd-audio.conf).
#
# Dev has no s6-overlay, so the backend's MPD reload hook takes its fallback
# branch and sends SIGHUP via `pkill -HUP mpd`; the MPD process started below
# restarts itself on change.

mkdir -p /opt/sonect/data
if [ ! -f /opt/sonect/data/mpd-audio.conf ]; then
  cat > /opt/sonect/data/mpd-audio.conf << 'MPDDROP'
# This file is managed by the Sonect frontend.
# It is owned by the service user, so no sudo is needed for edits.

audio_output {
    type        "null"
    name        "Dev Output (Silent)"
}
MPDDROP
fi

# Install rtk (Rust Token Killer, https://github.com/rtk-ai/rtk) so agents can
# use the token-optimized commands documented in AGENTS.md. Install it into
# /usr/local/bin because that directory is already on the default PATH of the
# non-interactive shells used by agents; a PATH export in this script would
# not persist. Idempotent.
if ! command -v rtk > /dev/null 2>&1; then
  echo "Installing rtk..."
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh \
    | RTK_INSTALL_DIR=/usr/local/bin sh
fi

if command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg $(ffmpeg -version | head -n1)"
else
  echo "⚠️  ffmpeg not found — waveform generation will use fallback"
fi

echo "Starting MPD in dev mode..."
mpd /etc/mpd.conf || true

echo "✅ Dev container ready"
