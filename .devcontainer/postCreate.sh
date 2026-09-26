#!/bin/bash
set -e

# Create the user-editable MPD drop-in (included by /etc/mpd.conf) so MPD has a
# default audio output in dev. Mirrors what installer.sh does in production.

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
# use the token-optimized commands documented in AGENTS.md. Idempotent.
if ! command -v rtk > /dev/null 2>&1; then
  echo "Installing rtk..."
  curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"

if command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg $(ffmpeg -version | head -n1)"
else
  echo "⚠️  ffmpeg not found — waveform generation will use fallback"
fi

echo "Starting MPD in dev mode..."
mpd /etc/mpd.conf || true

echo "✅ Dev container ready"
