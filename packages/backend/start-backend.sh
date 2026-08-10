#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "[backend] Starting..."

if [ ! -f bundle.cjs ]; then
  echo "[backend] bundle.cjs not found — did you run 'pnpm bundle'?"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "[backend] Installing production dependencies..."
  pnpm install --prod
fi

exec node bundle.cjs
