#!/bin/bash
set -e

# ─────────────────────────────────────────────
#  Sonect — Raspberry Pi Installer
#  Downloads prebuilt artifacts from GitHub CI
# ─────────────────────────────────────────────

REPO="Koberum/Sonect"
APPNAME="sonect"
INSTALL_DIR="/opt/$APPNAME"
BACKEND_DIR="$INSTALL_DIR/backend"
FRONTEND_DIR="$INSTALL_DIR/frontend"
SERVICE_USER="${SUDO_USER:-pi}"

RED='\033[0;31m'; GREEN='\033[0;32m'
YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

log()    { echo -e "${GREEN}[✔]${NC} $1"; }
warn()   { echo -e "${YELLOW}[!]${NC} $1"; }
error()  { echo -e "${RED}[✘]${NC} $1"; exit 1; }
header() {
  echo -e "\n${GREEN}══════════════════════════════════════${NC}"
  echo -e "${GREEN}  $1${NC}"
  echo -e "${GREEN}══════════════════════════════════════${NC}"
}

if [ "$EUID" -ne 0 ]; then
  error "Run as root: sudo bash installer.sh"
fi

header "$APPNAME Installer"

# ── 1. System dependencies ───────────────────
header "1/5 — System dependencies"
apt-get update -qq
apt-get install -y \
  curl \
  jq \
  mpd \
  alsa-utils \
  dumb-init \
  python3 \
  python3-venv \
  cifs-utils \
  nfs-common
log "System packages installed"

# Stop the running sonect service so files are not in use during install
systemctl stop ${APPNAME} 2>/dev/null || true
log "Stopped ${APPNAME} service (if running)"

# ── 2. Node.js 22 + pnpm ─────────────────────
header "2/5 — Node.js 22 + pnpm"
ARCH=$(dpkg --print-architecture)
log "Architecture: $ARCH"

if [[ "$ARCH" == "amd64" || "$ARCH" == "arm64" ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
elif [[ "$ARCH" == "armhf" || "$ARCH" == "armel" ]]; then
  warn "armhf detected — using official Node.js 22 binaries"
  NODE_VERSION="22.14.0"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-armv7l.tar.xz" \
    -o /tmp/node.tar.xz
  tar -xJf /tmp/node.tar.xz -C /tmp
  cp -r "/tmp/node-v${NODE_VERSION}-linux-armv7l"/* /usr/local/
  rm -rf /tmp/node*
else
  error "Unsupported architecture: $ARCH"
fi

log "Node.js: $(node --version)"

if ! command -v pnpm &>/dev/null; then
  npm install -g pnpm
fi
log "pnpm: $(pnpm --version)"

# ── 3. Directory structure ────────────────────
header "3/5 — Directory structure"
mkdir -p "$BACKEND_DIR"
mkdir -p "$FRONTEND_DIR"
chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
log "Created $INSTALL_DIR"

# ── 4. Download release ─────────────────────
header "4/5 — Download release"

DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/sonect.tar.gz"
TMP_TAR=$(mktemp /tmp/sonect-XXXXXX.tar.gz)
echo "  → Downloading latest release: $DOWNLOAD_URL"
if ! curl -fsSL "$DOWNLOAD_URL" -o "$TMP_TAR"; then
  rm -f "$TMP_TAR"
  error "Download failed. Is the repo public and does a release exist?"
fi

STAGE=$(mktemp -d)
tar -xzf "$TMP_TAR" -C "$STAGE"
rm -f "$TMP_TAR"

replace_dir() {
  local NAME=$1
  local DEST=$INSTALL_DIR/$NAME
  local SRC=$STAGE/$NAME

  if [ ! -d "$SRC" ]; then
    error "Release archive missing '$NAME' directory"
  fi

  if [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then
    local BACKUP="${DEST}_backup_$(date +%Y%m%d_%H%M%S)"
    warn "Backing up old $NAME → $BACKUP"
    cp -r "$DEST" "$BACKUP"
  fi

  rm -rf "$DEST"
  mkdir -p "$DEST"
  cp -r "$SRC/." "$DEST/"
  chmod +x "$DEST"/*.sh 2>/dev/null || true
  chown -R "$SERVICE_USER:$SERVICE_USER" "$DEST"
  log "$NAME installed to $DEST"
}

replace_dir "backend"
replace_dir "frontend"
rm -rf "$STAGE"

INSTALLED_VERSION="$(cat "$BACKEND_DIR/.version" 2>/dev/null || echo unknown)"
echo "$INSTALLED_VERSION" > "$BACKEND_DIR/.last_version"
log "Sonect version: $INSTALLED_VERSION"

# Backup database before upgrade
DB_PATH="$INSTALL_DIR/data/music.db"
if [ -f "$DB_PATH" ]; then
  BACKUP_DB="${DB_PATH}.backup-$(date +%Y%m%d_%H%M%S)"
  cp "$DB_PATH" "$BACKUP_DB"
  log "Database backed up → $BACKUP_DB"
fi

# Install native dependencies (ARM prebuilt binaries)
echo ""
log "Installing native dependencies (sharp)..."
(cd "$BACKEND_DIR" && pnpm install --prod)
log "Native dependencies installed"

# ── Write minimal MPD config ──
cat > /etc/mpd.conf << 'MPDEOF'
music_directory "/opt/sonect/music"
playlist_directory "/var/lib/mpd/playlists"
db_file "/var/lib/mpd/tag_cache"
state_file "/var/lib/mpd/state"
sticker_file "/var/lib/mpd/sticker.sql"
user "mpd"
bind_to_address "localhost"
port "6600"
log_file "/var/lib/mpd/mpd.log"

# User-editable settings are managed from the Sonect frontend
# and live in a service-user-owned drop-in file
include "/opt/sonect/data/mpd-audio.conf"
MPDEOF
log "Minimal /etc/mpd.conf written"

# Create MPD drop-in config owned by the service user (preserved across re-installs)
mkdir -p "$INSTALL_DIR/data"
if [ ! -f "$INSTALL_DIR/data/mpd-audio.conf" ]; then
  cat > "$INSTALL_DIR/data/mpd-audio.conf" << 'MPDDROP'
# This file is managed by the Sonect frontend.
# It is owned by the service user, so no sudo is needed for edits.
MPDDROP
  log "MPD drop-in config created at $INSTALL_DIR/data/mpd-audio.conf"
else
  log "MPD drop-in config already exists, preserving existing content"
fi
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/data/mpd-audio.conf"

# Set up music directory
mkdir -p "$INSTALL_DIR/music"
chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/music"
log "$INSTALL_DIR/music directory ready"

# Allow the service user to restart/stop MPD without a password
echo "$SERVICE_USER ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart mpd, /usr/bin/systemctl stop mpd" \
  > /etc/sudoers.d/sonect-mpd 2>/dev/null || \
  warn "Could not create sudoers entry for MPD restart/stop"
chmod 440 /etc/sudoers.d/sonect-mpd 2>/dev/null || true

# Allow mount/umount for storage sources without a password
for cmd in /usr/bin/mount /usr/bin/umount; do
  if [ -f "$cmd" ]; then
    echo "$SERVICE_USER ALL=(ALL) NOPASSWD: $cmd" >> /etc/sudoers.d/sonect-storage
  fi
done
chmod 440 /etc/sudoers.d/sonect-storage 2>/dev/null || true
log "Sudoers entries for mount/umount created"

# Create default .env if missing
if [ ! -f "$BACKEND_DIR/.env" ]; then
  log "Creating default .env..."
  mkdir -p "$INSTALL_DIR/data/covers" "$INSTALL_DIR/data"
  chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/data"
  cat > "$BACKEND_DIR/.env" <<- ENV
MPD_HOST=localhost
MPD_PORT=6600
MUSIC_DIR=$INSTALL_DIR/music
COVERS_DIR=$INSTALL_DIR/data/covers
DB_PATH=$INSTALL_DIR/data/music.db
PORT=3000
ENV
  log ".env created"
fi

# ── 5. Systemd service ───────────────────────
header "5/5 — Systemd service"

cat > /etc/systemd/system/${APPNAME}.service <<EOF
[Unit]
Description=$APPNAME
After=network.target sound.target mpd.service
Wants=mpd.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$BACKEND_DIR
ExecStart=/bin/bash $BACKEND_DIR/start-backend.sh
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production
Environment=FRONTEND_DIST=$FRONTEND_DIR
Environment=PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${APPNAME}
systemctl restart ${APPNAME}

sleep 2

# ── Done ──────────────────────────────────────
header "🔄 Installation complete!"
echo ""
echo "  ${GREEN}Sonect $INSTALLED_VERSION runs as a single process on port 3000${NC}"
echo ""
systemctl is-active --quiet ${APPNAME} \
  && echo -e "  ${GREEN}● ${APPNAME}   RUNNING${NC}" \
  || echo -e "  ${RED}● ${APPNAME}   STOPPED${NC}"
echo ""
echo -e "  ${YELLOW}Logs:${NC}  journalctl -u ${APPNAME} -f"
echo -e "  ${YELLOW}Web:${NC}   http://$(hostname -I | awk '{print $1}'):3000"
echo ""
