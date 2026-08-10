---
name: sonect-new-route
description: Add a new API route or endpoint to the Sonect backend. Use this skill whenever creating a new route file, adding a new URL prefix (e.g. /playlists, /library, /queue), wiring up a new controller, or extending an existing router with new endpoints. The Vite proxy step is easy to miss and silently breaks dev — this skill's checklist prevents that. Trigger whenever the user asks to add an endpoint, create a new feature with backend routes, or extend the API.
---

# Adding a New Route in Sonect

Every new route requires changes across several files. Miss one and things break silently. Follow this checklist in order.

---

## The checklist

### 1. Schema — `packages/types/src/schemas.ts`

Define Zod schemas for request bodies and params here, not inline in controllers:

```ts
// packages/types/src/schemas.ts
import { z } from "zod";

export const createPlaylistSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const playlistParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
```

Export all schemas — they're imported by both controllers and potentially tests.

### 2. Service — `packages/backend/src/services/`

Business logic lives here. Services are pure functions — no `req`/`res` knowledge:

```ts
// packages/backend/src/services/playlistService.ts
import { db } from "@repo/db";
import type { Playlist } from "@repo/types";

export async function createPlaylist(name: string, description?: string): Promise<Playlist> {
  return db.playlists.create({ name, description });
}

export async function getPlaylistById(id: number): Promise<Playlist> {
  const playlist = await db.playlists.findById(id);
  if (!playlist) throw new NotFoundError(`Playlist ${id} not found`);
  return playlist;
}
```

### 3. Controller — `packages/backend/src/controllers/`

Controllers validate input with Zod, call the service, and shape the response. Wrapped in `asyncHandler`:

```ts
// packages/backend/src/controllers/playlistController.ts
import { asyncHandler } from "../middleware/asyncHandler.js";
import { createPlaylistSchema, playlistParamsSchema } from "@repo/types/schemas.js";
import * as playlistService from "../services/playlistService.js";

export const createPlaylistController = asyncHandler(async (req, res) => {
  const { name, description } = createPlaylistSchema.parse(req.body); // ZodError → 400
  const playlist = await playlistService.createPlaylist(name, description);
  res.status(201).json(playlist);
});

export const getPlaylistController = asyncHandler(async (req, res) => {
  const { id } = playlistParamsSchema.parse(req.params); // ZodError → 400
  const playlist = await playlistService.getPlaylistById(id);
  res.json(playlist);
});
```

### 4. Route — `packages/backend/src/routes/`

Wire controllers to HTTP methods:

```ts
// packages/backend/src/routes/playlists.ts
import { Router } from "express";
import { createPlaylistController, getPlaylistController } from "../controllers/playlistController.js";

export const playlistsRouter = Router();

playlistsRouter.get("/:id", getPlaylistController);
playlistsRouter.post("/", createPlaylistController);
```

### 5. Register in `app.ts`

```ts
// packages/backend/src/app.ts
import { playlistsRouter } from "./routes/playlists.js";

app.use("/playlists", playlistsRouter);
```

### 6. ⚠️ Vite proxy — `packages/frontend/vite.config.ts`

**This is the most commonly forgotten step.** Without it, frontend API calls to the new prefix get a 404 in dev because Vite doesn't know to forward them to the backend on port 3000.

```ts
// packages/frontend/vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/player": "http://localhost:3000",
      "/library": "http://localhost:3000",
      "/covers": "http://localhost:3000",
      "/playlists": "http://localhost:3000", // ← add your new prefix here
    },
  },
});
```

Add one entry per top-level route prefix. If you skip this, frontend API calls will silently 404 in dev but work fine in production — very confusing to debug.

---

## Quick reference: file locations

| What | Where |
|------|-------|
| Zod schemas | `packages/types/src/schemas.ts` |
| Business logic | `packages/backend/src/services/<feature>Service.ts` |
| Request handling | `packages/backend/src/controllers/<feature>Controller.ts` |
| HTTP routing | `packages/backend/src/routes/<feature>.ts` |
| Route registration | `packages/backend/src/app.ts` |
| Vite dev proxy | `packages/frontend/vite.config.ts` |

---

## Error handling

- Throw `NotFoundError` when a resource doesn't exist → `errorHandler` returns 404
- Throw `ValidationError` for business-logic validation failures → returns 400
- `ZodError` from `schema.parse()` is caught by `errorHandler` → returns 400 with `fieldErrors`
- Don't catch errors in controllers unless you have a specific reason — let `errorHandler` handle them

---

## Final verification

```bash
pnpm lint     # zero errors
pnpm build    # zero TypeScript errors
pnpm backend:test  # all tests pass
```

Then test the new endpoint manually with curl or the frontend, making sure the Vite proxy routes correctly in dev.
