#!/bin/sh
# Restart MPD whenever the drop-in config changes.
#
# The Sonect backend writes /mpd-config/mpd-audio.conf and expects MPD to pick
# the change up on its own — there is no systemctl/sudo involved.
set -eu

CONFIG="/mpd/mpd.conf"
DROPIN="/mpd-config/mpd-audio.conf"

mkdir -p /mpd-state/playlists /mpd-logs
# The drop-in may not exist yet; create an empty one so MPD always has an
# include target and inotify can watch it.
[ -f "$DROPIN" ] || : > "$DROPIN"

MPD_PID=0

start_mpd() {
  mpd --no-daemon "$CONFIG" &
  MPD_PID=$!
}

stop_mpd() {
  if [ "$MPD_PID" -gt 0 ]; then
    kill "$MPD_PID" 2>/dev/null || true
    wait "$MPD_PID" 2>/dev/null || true
  fi
}

term() {
  stop_mpd
  exit 0
}
trap term TERM INT

start_mpd

# Watch the drop-in; restart MPD on any write/replace.
while inotifywait -q -e close_write,move,create,delete "$DROPIN" >/dev/null 2>&1; do
  echo "[mpd] config changed, restarting" >&2
  stop_mpd
  start_mpd
done &

WATCH_PID=$!

# Reap MPD if it exits on its own.
wait "$MPD_PID"
stop_mpd
kill "$WATCH_PID" 2>/dev/null || true
