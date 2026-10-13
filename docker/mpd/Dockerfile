# Sonect MPD image — MPD daemon with a config-change watcher.
#
# The Sonect backend never restarts MPD (no privileged commands): it only
# writes the drop-in `/mpd-config/mpd-audio.conf`. This entrypoint restarts the
# MPD process whenever that file changes, so settings saved from the UI apply
# automatically.
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      mpd \
      alsa-utils \
      inotify-tools \
      tini \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY mpd.conf /mpd/mpd.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Shared volumes: music library, config drop-in, state (tag cache/playlists),
# and the log file read by the backend for per-file sync progress.
VOLUME ["/libraries", "/mpd-config", "/mpd-state", "/mpd-logs"]

EXPOSE 6600

ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
