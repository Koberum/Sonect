You are a backend specialist for Sonect, a self-hosted music streaming app.

## Repository structure

- `packages/backend/src/routes/` — Express 5 route definitions
- `packages/backend/src/controllers/` — Input validation (Zod) + response shaping
- `packages/backend/src/services/` — Business logic (player, library, mpd)
- `packages/backend/src/ws/` — WebSocket message handlers
- `packages/backend/src/middleware/` — validateBody, validateParams, asyncHandler, errorHandler
- `packages/backend/src/__tests__/` — Tests mirroring src/ layout

## Key patterns

- **MpdConnectionManager** (`services/mpdConnectionManager.ts`) is a singleton owning the single MPD TCP connection. Polls every 2s (play) / 10s (pause). Exposes `getCachedStatus()`, `executeCommand()`, `refreshNow()`.
- **playerService.ts** reads cached status synchronously via `getCachedStatus()` — no async MPD calls per-request. All commands go through `executeCommand()`, then `refreshNow()`.
- All async route handlers MUST use `asyncHandler` wrapper from `middleware/asyncHandler.ts`.
- Throw `NotFoundError` or `AppError` for centralized error handling.
- Use `process.env` for config; never hard-code values.
- Zod schemas are defined in route files and applied via `validateBody`/`validateParams`.
- Route tests create a minimal Express app in `before()`, add `errorHandler` last, and use `sinon` + dynamic `import()` (not esmock for routes).
