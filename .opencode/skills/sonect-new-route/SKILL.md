---
name: sonect-new-route
description: Add a new API route or endpoint to the Sonect backend. Use this skill whenever creating a new route file, adding a new URL prefix (e.g. /playlists, /waveforms), wiring up a new controller, or extending an existing router with new endpoints. The Vite proxy step is easy to miss and silently breaks dev — this skill's checklist prevents that. Trigger whenever the user asks to add an endpoint, create a new feature with backend routes, or extend the API.
---

# Adding a New Route in Sonect

Every new route requires changes across several files. Miss one and things break silently. Follow this checklist in order.

---

## The checklist

### 1. Schema — `packages/types/src/schemas/types.ts`

Zod schemas live in `@repo/types` as **grouped objects** (`playlistSchemas`, `catalogSchemas`, `systemSchemas`, `playerSchemas`, `sessionSchemas`, `profileSchemas`), re-exported from `packages/types/src/schemas/index.ts` and importable as `@repo/types/schemas` (no `.js` suffix):

```ts
// packages/types/src/schemas/types.ts
export const playlistSchemas = {
  // ...existing entries (idParam, trackIdParam, create, update, addTrack)...
  rename: z.object({
    name: z.string().min(1, "name is required").max(255),
  }),
};
```

Add the new member to the matching existing group — do not create a new top-level file. Grouped schemas are imported by controllers and tests.

### 2. Service — `packages/backend/src/services/<domain>/`

Business logic lives here as a **class using the `@repo/db` repositories** (e.g. `playlistsDb`), exposed through the service factory. Services have no `req`/`res` knowledge:

```ts
// packages/backend/src/services/library/playlistService.ts
import { playlistsDb } from "@repo/db";
import { Playlist } from "@repo/types/catalog";

export interface PlaylistService {
  // ...existing methods...
  renamePlaylist(id: number, name: string): Playlist | undefined;
}

export class PlaylistServiceImpl implements PlaylistService {
  // ...existing methods...
  renamePlaylist(id: number, name: string): Playlist | undefined {
    const playlist = playlistsDb.getById(id);
    if (!playlist) return undefined;
    playlistsDb.update(id, { name });
    return playlistsDb.getById(id);
  }
}
```

Add the new method to the `PlaylistService` interface too. Register the instance lazily in `packages/backend/src/services/factory.ts` (`initializeServices()` + a `get<Name>Service()` accessor).

### 3. Controller — `packages/backend/src/controllers/`

Controllers parse input with the grouped Zod schemas, call the service via the factory accessor, and shape the response. Wrapped in `asyncHandler`:

```ts
// packages/backend/src/controllers/playlistController.ts
import { playlistSchemas } from "@repo/types/schemas";
import { getPlaylistService } from "@services/factory";
import { asyncHandler } from "@middleware/asyncHandler";
import { NotFoundError } from "@middleware/errorHandler";

export const renamePlaylistHandler = asyncHandler(async (req, res) => {
  const { id } = playlistSchemas.idParam.parse(req.params);
  const { name } = playlistSchemas.rename.parse(req.body); // ZodError → 400
  const playlist = getPlaylistService().renamePlaylist(id, name);
  if (!playlist) throw new NotFoundError("Playlist");
  res.json(playlist);
});
```

### 4. Route — `packages/backend/src/routes/<feature>Routes.ts`

Wire controllers to HTTP methods; the router is a **default export**:

```ts
// packages/backend/src/routes/playlistRoutes.ts
import { Router } from "express";
import { renamePlaylistHandler } from "../controllers/playlistController";

const router = Router();
router.patch("/:id/rename", renamePlaylistHandler);

export default router;
```

### 5. Register in `app.ts`

```ts
// packages/backend/src/app.ts
import playlistRoutes from "@routes/playlistRoutes";
app.use("/playlists", playlistRoutes);
```

### 6. ⚠️ Vite proxy — `packages/frontend/vite.config.ts`

**This is the most commonly forgotten step.** Without it, frontend API calls to the new prefix get a 404 in dev because Vite doesn't know to forward them to the backend on port 3000.

```ts
// packages/frontend/vite.config.ts — existing proxy entries
server: {
  proxy: {
    "/player": "http://localhost:3000",
    "/catalog": "http://localhost:3000",
    "/playlists": "http://localhost:3000", // ← add your new prefix here
    "/covers": "http://localhost:3000",
    "/waveforms": "http://localhost:3000",
    "/stream": "http://localhost:3000",
    "/system": "http://localhost:3000",
    "/dashboard": "http://localhost:3000",
    "/session": "http://localhost:3000",
    "/profiles": "http://localhost:3000",
    "/ws": { target: "ws://localhost:3000", ws: true },
  },
}
```

Add one entry per top-level route prefix (including `/ws` for WebSocket paths). If you skip this, frontend API calls will silently 404 in dev but work fine in production — very confusing to debug.

---

## Quick reference: file locations

| What                  | Where                                                             |
| --------------------- | ----------------------------------------------------------------- |
| Zod schemas (grouped) | `packages/types/src/schemas/types.ts`                             |
| Business logic        | `packages/backend/src/services/<domain>/<feature>Service.ts`      |
| Service wiring        | `packages/backend/src/services/factory.ts`                        |
| Request handling      | `packages/backend/src/controllers/<feature>Controller.ts`         |
| HTTP routing          | `packages/backend/src/routes/<feature>Routes.ts` (default export) |
| Route registration    | `packages/backend/src/app.ts`                                     |
| Vite dev proxy        | `packages/frontend/vite.config.ts`                                |

---

## Error handling

- Throw `NotFoundError` when a resource doesn't exist → `errorHandler` returns 404
- Throw `ValidationError` for business-logic validation failures → returns 400
- Throw `ConflictError` for uniqueness conflicts → 409; `LockedError` → 423
- `ZodError` from `schema.parse()` is caught by `errorHandler` → returns 400 with `{ error, details: flatten().fieldErrors }`
- Don't catch errors in controllers unless you have a specific reason — let `errorHandler` handle them

---

## Final verification

```bash
pnpm lint     # zero errors
pnpm build    # zero TypeScript errors
pnpm backend:test  # all tests pass
```

Then test the new endpoint manually with curl or the frontend, making sure the Vite proxy routes correctly in dev.
