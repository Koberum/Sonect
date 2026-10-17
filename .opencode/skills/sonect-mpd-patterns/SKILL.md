---
name: sonect-mpd-patterns
description: Write or review code that interacts with MPD (Music Player Daemon) in the Sonect backend. Use this skill whenever touching playerService.ts, mpdConnectionManager.ts, or any code that reads playback state or sends MPD commands. The polling-based cache architecture has specific rules that are easy to violate — this skill prevents the most common mistakes. Trigger whenever you see imports of mpdConnectionManager, references to MPD commands, or work on playerService.ts or player routes.
---

# Sonect MPD Architecture

Sonect uses a **polling-based cache** — MPD is never queried directly per-request. All reads come from an in-memory cache; all writes go through `mpdConnectionManager.executeCommand()` / `executeCommandList()`.

```
User action
    │
    ▼
executeCommand()        ← sends command to MPD via cmdClient (dedicated command connection)
    │
    ▼
refreshNow()            ← fires an immediate status poll (fire-and-forget)
    │
    ▼
status poll             ← pollSocket fetches MPD status, updates PlaybackStatus cache
    │
    ▼
stateChanged event      ← emitted to subscribers (WebSocket handler listens here)
    │
    ▼
WebSocket broadcast     ← all connected clients receive updated state via broadcast.ts
```

Polling interval: **2s during play**, **10s during pause/stop**.

`MpdConnectionManager` (`services/mpd/mpdConnectionManager.ts`) maintains **two** TCP connections internally:

- `cmdClient` — sends commands via the `mpd` npm package (play, pause, setvol, …)
- `pollSocket` — raw-TCP socket that polls `status` on a timer

This two-connection design prevents commands from interleaving with polls (the `mpd` package's `idle`-based callback queue caused silent polling failures, which is why the poll side is raw TCP).

---

## The golden rule: `playerService.ts` is synchronous (with one exception)

`PlayerServiceImpl` never makes async MPD calls for status reads. It reads the cache:

```ts
// CORRECT — synchronous cache read
public getPlaybackStatus(): PlaybackStatus {
  return this.mpdConnectionManager.getCachedStatus();
}

// WRONG — do not do this
public async getPlaybackStatus(): Promise<PlaybackStatus> {
  const status = await this.mpdConnectionManager.executeCommand("status"); // NO
  return parseStatus(status);
}
```

**The one exception:** `getQueue()` runs an async `playlistinfo` MPD query — it cannot use the cache because the queue is not part of the polled `status` response:

```ts
// CORRECT — getQueue() is the only async read in playerService
public async getQueue(): Promise<QueuedTrack[]> {
  const raw = await this.mpdConnectionManager.executeCommand("playlistinfo");
  return this.parseQueueResponse(raw);
}
```

Any other read that isn't `getQueue()` should use `getCachedStatus()`. If you find yourself writing a new `await`-based read in `playerService.ts`, stop and reconsider.

---

## Sending commands

All MPD commands go through `MpdConnectionManager`. Batches (multiple `add` commands) use `executeCommandList()`. After every user-initiated command, fire `refreshNow()` **without awaiting** — this is the actual pattern used throughout `playerService.ts`:

```ts
public async pauseTrack(): Promise<PlayTrackResponse> {
  await this.mpdConnectionManager.executeCommand("pause");
  this.mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after pauseTrack:", err);
  });
  return { success: true };
}

public async queueFiles(files: string[]): Promise<void> {
  if (files.length === 0) return;
  const commands = files.map((f) => ({ command: "add" as const, args: [f] }));
  await this.mpdConnectionManager.executeCommandList(commands);
}
```

`refreshNow()` skips the refresh when a poll is already in flight (the next tick applies), so it is a best-effort prompt update, never a guarantee.

---

## Do not create additional MPD connections

`MpdConnectionManager` owns both TCP connections. Never reach around it:

```ts
// WRONG — creates a rogue MPD connection outside the manager
import mpd from "mpd";
const client = mpd.connect({ host: "localhost", port: 6600 });

// CORRECT — always go through the factory-managed singleton
import { getMpdConnectionManager } from "@services/factory";
const mpdConnectionManager = getMpdConnectionManager();
await mpdConnectionManager.executeCommand("play");
```

All MPD communication in the backend goes through the manager obtained from `getMpdConnectionManager()` (wired once in `services/factory.ts`; tests may substitute with Sinon stubs/DI).

---

## Adding a new playback command

Pattern for adding a new command (e.g., `seek`):

1. **playerService.ts** — add a class method:

```ts
public async seekTo(seconds: number): Promise<void> {
  await this.mpdConnectionManager.executeCommand("seekcur", [seconds.toString()]);
  this.mpdConnectionManager.refreshNow().catch((err) => {
    console.error("[Player] refreshNow failed after seekTo:", err);
  });
}
```

2. **Schema** — add a member to the matching group in `packages/types/src/schemas/types.ts`:

```ts
export const playerSchemas = {
  // ...existing entries...
  seekTo: z.object({ seconds: z.number().min(0) }),
};
```

3. **Controller** — parse with the grouped schema and call the session engine:

```ts
import { playerSchemas } from "@repo/types/schemas";
import { resolvePlayerRouter } from "@services/player/playerRouter.js";

export const seekHandler = asyncHandler(async (req, res) => {
  const { seconds } = playerSchemas.seekTo.parse(req.body); // ZodError → 400 via errorHandler
  await resolvePlayerRouter()
    .forSession(req.sessionId as string)
    .seek(seconds);
  res.json({ success: true });
});
```

4. **Route** — wire the controller in `routes/unifiedPlayerRoutes.ts` (playback is per-session through `/player`, never a global MPD call).

5. **refreshNow** is fired inside the service — the controller doesn't call it again.

---

## Reading cached state in the WebSocket handler

The WS handler reads the cache on connect and then listens for `stateChanged` events — it does not poll MPD itself. Messages use the `{ type, ... }` envelope and `broadcast(data)` takes a single argument:

```ts
import { broadcast } from "./broadcast.js";

// On a new connection — send current state immediately
ws.send(
  JSON.stringify({
    type: "player-status",
    ...mpdConnectionManager.getCachedStatus(),
  }),
);

// Subscribe to subsequent updates
const onStateChanged = () => {
  sendJson(ws, {
    type: "player-status",
    ...mpdConnectionManager.getCachedStatus(),
  });
};
mpdConnectionManager.on("stateChanged", onStateChanged);
ws.on("close", () => mpdConnectionManager.off("stateChanged", onStateChanged));

// Fan-out helper (used by sync progress etc.)
broadcast({ type: "sync-progress", current: 1, total: 10 });
```

Don't set up your own polling interval in the WS handler — the connection manager handles timing.

---

## Checklist

- [ ] No `await` for status reads in `playerService.ts` — use `getCachedStatus()` (except `getQueue()`)
- [ ] Commands use `executeCommand()` (single) or `executeCommandList()` (batch)
- [ ] Every user-initiated command is followed by `refreshNow().catch(...)` (fire-and-forget)
- [ ] No direct MPD connections created outside `MpdConnectionManager` (use `getMpdConnectionManager()`)
- [ ] New schemas are members of a group in `packages/types/src/schemas/types.ts` and parsed in controllers via `schema.parse()`
- [ ] WS messages use the `{ type: "player-status", ... }` envelope and `broadcast(data)` (single argument)
