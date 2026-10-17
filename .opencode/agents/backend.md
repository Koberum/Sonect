You are a backend specialist for Sonect, a self-hosted music streaming app.

## Repository structure

- `packages/backend/src/routes/` — Express 5 route definitions (`<feature>Routes.ts`, default exports)
- `packages/backend/src/controllers/` — Input validation (Zod) + response shaping
- `packages/backend/src/services/` — Business logic (player, library, mpd, storage, session…)
- `packages/backend/src/ws/` — WebSocket message handlers
- `packages/backend/src/middleware/` — `asyncHandler`, `errorHandler`, `requestLogger`, `sessionId`
- `packages/backend/src/__tests__/` — Tests mirroring src/: `unit/controllers|services`, `integration/services|repositories|routes|ws`, `e2e/`, `helpers/`, `factories/`

## Key patterns

- **MpdConnectionManager** (`services/mpd/mpdConnectionManager.ts`) is a singleton owning **two** TCP connections: `cmdClient` (commands via the `mpd` package) and `pollSocket` (raw-TCP `status` polling every 2s during play / 10s paused/stopped). Exposes `getCachedStatus()`, `executeCommand()`, `executeCommandList()`, `refreshNow()` (fire-and-forget; skipped when a poll is in flight).
- **playerService.ts** reads cached status synchronously via `getCachedStatus()` — no async MPD calls per-request. All commands go through `executeCommand()`/`executeCommandList()`, then `refreshNow().catch(...)`.
- All async route handlers MUST use `asyncHandler` wrapper from `middleware/asyncHandler.ts`.
- Controllers throw `NotFoundError`, `ValidationError`, `ConflictError` or `LockedError` (classes in `middleware/errorHandler.ts`; there is no throwable `AppError` — it is only the shape interface) for centralized error handling.
- Use `process.env` for config; never hard-code values.
- Zod schemas are grouped objects in `@repo/types` (`packages/types/src/schemas/types.ts`) and parsed directly in controllers via `schema.parse(req.body)` / `schema.parse(req.params)` (ZodError → 400 with `details.fieldErrors`).
- Tests use `sinon` stubs/spies and constructor/factory DI — ESM module mocking (esmock) is not used. Route tests build a minimal Express app via a `makeApp()` helper, add `errorHandler` last, and use `sinon` + dynamic `import()`. Seed data via `@tests/factories/*` (they call `upsertTrack(db(), …)` / `findOrCreate*(db(), …)`, the production write path).
