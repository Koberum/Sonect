# ---- Build stage ----
FROM node:24-alpine AS builder
WORKDIR /build

RUN apk add --no-cache python3 make g++ libc6-compat
RUN npm install -g pnpm@10.34.7

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
RUN apk add --no-cache dumb-init ffmpeg alsa-utils usbutils
RUN npm install -g pnpm@10.34.7

WORKDIR /app

# Build-time version stamped into /app/.version, read by readAppVersion().
ARG SONECT_VERSION=dev

COPY --from=builder /build/packages/backend/dist/bundle.cjs ./bundle.cjs
COPY --from=builder /build/packages/frontend/dist ./frontend/dist/

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

# Strip a leading "v" so both `v1.2.3` and `1.2.3` tags report the same string.
RUN printf '%s' "${SONECT_VERSION#v}" > /app/.version

RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000

CMD ["dumb-init", "node", "bundle.cjs"]
