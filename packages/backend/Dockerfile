ARG PNPM_VERSION=12.18.0

# ---- Build stage ----
FROM node:24-alpine AS builder
ARG PNPM_VERSION
WORKDIR /build

RUN apk add --no-cache python3 make g++ libc6-compat
RUN npm install -g pnpm@${PNPM_VERSION}

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types ./packages/types
COPY packages/db ./packages/db
COPY packages/backend ./packages/backend
COPY packages/frontend ./packages/frontend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @repo/types build && \
    pnpm --filter @repo/db build && \
    pnpm --filter backend bundle && \
    pnpm --filter frontend build

# ---- Production stage ----
FROM node:24-alpine
ARG PNPM_VERSION
RUN apk add --no-cache ffmpeg alsa-utils mpd xz ca-certificates
RUN npm install -g pnpm@${PNPM_VERSION}

# s6-overlay v3 supervisord: runs the mpd and node longruns as siblings.
ARG S6_OVERLAY_VERSION=3.2.0.0
ARG TARGETARCH
RUN case "$TARGETARCH" in \
      amd64) S6_ARCH=x86_64 ;; \
      arm64) S6_ARCH=aarch64 ;; \
      *) echo "unsupported arch: $TARGETARCH" >&2; exit 1 ;; \
    esac \
 && wget -qO- "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" | tar -Jxpf - -C / \
 && wget -qO- "https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-${S6_ARCH}.tar.xz" | tar -Jxpf - -C /

WORKDIR /app

COPY --from=builder /build/packages/backend/dist/bundle.cjs ./bundle.cjs
# The bundled SONECT_BUNDLE_URL anchor resolves MIGRATIONS_FOLDER to
# /app/drizzle/ (bundle.cjs sits in /app). Without this the migrator fails at
# startup with ENOENT scandir '/app/drizzle/'. Do not remove.
COPY --from=builder /build/packages/backend/dist/drizzle ./drizzle
COPY --from=builder /build/packages/frontend/dist ./frontend/dist/

# Base MPD config (immutable) and the s6-overlay service tree. The drop-in
# /app/data/mpd-audio.conf is created at runtime by the mpd longrun.
COPY docker/mpd.conf /etc/mpd/mpd.conf
COPY docker/s6/s6-rc.d /etc/s6-overlay/s6-rc.d

RUN cat > package.json <<-'PKGJSON'
{
  "name": "sonect-backend",
  "private": true,
  "type": "module",
  "dependencies": {
    "sharp": "^0.35.5",
    "dotenv": "^18.0.7"
  }
}
PKGJSON

RUN pnpm install --prod

ENV NODE_ENV=production
ENV FRONTEND_DIST=/app/frontend/dist
ENV DB_PATH=/app/data/music.db
ENV COVERS_DIR=/app/data/covers
ENV WAVEFORMS_DIR=/app/data/waveforms
ENV MPD_CONFIG_PATH=/app/data/mpd-audio.conf
ENV MPD_HOST=127.0.0.1
ENV MPD_PORT=6600

RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000

# Container health reported to the orchestrator (docker ps, compose).
# wget is already present in node:24-alpine; /health is a dependency-free
# Express route that only confirms the HTTP server is answering.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null --tries=1 --timeout=5 http://127.0.0.1:${PORT:-3000}/health

# node:24-alpine ships CMD ["node"]; clear it so s6 does not run an extra CMD
# that exits immediately (which would tear the container down). mpd + node run
# as supervised s6 longruns instead.
ENTRYPOINT ["/init"]
CMD []
