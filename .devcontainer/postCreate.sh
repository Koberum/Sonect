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

echo "Starting MPD in dev mode..."
mpd /etc/mpd.conf || true

echo "✅ Dev container ready"
