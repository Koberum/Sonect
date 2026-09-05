# ---- Build stage ----
FROM node:22-alpine AS builder
WORKDIR /build

RUN apk add --no-cache python3 make g++ libc6-compat
RUN npm install -g pnpm@9

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
FROM node:22-alpine
RUN apk add --no-cache dumb-init
RUN npm install -g pnpm@9

WORKDIR /app

COPY --from=builder /build/packages/backend/dist/bundle.cjs ./bundle.cjs
COPY --from=builder /build/packages/frontend/dist ./frontend/dist/

RUN cat > package.json <<- 'PKGJSON'
{
  "name": "sonect-backend",
  "private": true,
  "type": "module",
  "dependencies": {
    "sharp": "^0.34.5",
    "dotenv": "^17.2.4"
  }
}
PKGJSON

RUN pnpm install --prod

ENV NODE_ENV=production
ENV FRONTEND_DIST=/app/frontend/dist
ENV DB_PATH=/app/data/music.db

RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000

CMD ["dumb-init", "node", "bundle.cjs"]
