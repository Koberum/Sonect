#!/bin/bash
set -e

# Create the user-editable MPD drop-in (included by /etc/mpd.conf) so MPD has a
# default audio output in dev. Mirrors what installer.sh does in production.

cat > /etc/mpd.conf << 'MPDDROP'

music_directory "/workspace/data/music"
playlist_directory "/var/lib/mpd/playlists"
db_file "/var/lib/mpd/tag_cache"
state_file "/var/lib/mpd/state"
sticker_file "/var/lib/mpd/sticker.sql"
log_file "/var/lib/mpd/mpd.log"

bind_to_address "0.0.0.0"
port "6600"

audio_output {
    type        "null"
    name        "Dev Output (Silent)"
}

# User-editable settings (audio output, advanced config) are managed from the
# Sonect frontend and live in a service-user-owned drop-in file, mirroring the
# production two-file architecture created by installer.sh.
include "/workspace/conf/mpd.conf"

MPDDROP


echo "🎶 Starting MPD in dev mode..."
mpd /etc/mpd.conf || true

echo "✅ Dev container ready"
