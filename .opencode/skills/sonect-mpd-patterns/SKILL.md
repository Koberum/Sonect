---
name: sonect-mpd-patterns
description: Write or review code that interacts with MPD (Music Player Daemon) in the Sonect backend. Use this skill whenever touching playerService.ts, mpdConnectionManager.ts, or any code that reads playback state or sends MPD commands. The polling-based cache architecture has specific rules that are easy to violate — this skill prevents the most common mistakes. Trigger whenever you see imports of mpdConnectionManager, references to MPD commands, or work on playerService.ts or player routes.
---

# Sonect MPD Architecture

Sonect uses a **polling-based cache** — MPD is never queried directly per-request. All reads come from an in-memory cache; all writes go through `mpdConnectionManager.executeCommand()`.

```
User action
    │
    ▼
executeCommand()        ← sends command to MPD via cmdClient (dedicated command connection)
    │
    ▼
refreshNow()            ← triggers an immediate status poll (don't wait for next tick)
    │
    ▼
status poll             ← pollClient fetches MPD status, updates PlaybackStatus cache
    │
    ▼
stateChanged event      ← emitted to subscribers (WebSocket handler listens here)
    │
    ▼
WebSocket broadcast     ← all connected clients receive updated state via broadcast.ts
```

Polling interval: **2s during play**, **10s during pause/stop**.

`MpdConnectionManager` maintains **two** TCP connections internally:
- `cmdClient` — sends commands (play, pause, setvol, etc.)
- `pollClient` — polls `status` on a timer

This two-connection design prevents commands from interleaving with polls.

---

## The golden rule: `playerService.ts` is synchronous (with one exception)

`playerService` never makes async MPD calls for status reads. It reads the cache:

```ts
// CORRECT — synchronous cache read
export function getStatus(): PlaybackStatus {
  return mpdConnectionManager.getCachedStatus();
}

// WRONG — do not do this
export async function getStatus(): Promise<PlaybackStatus> {
  const status = await mpdClient.sendCommand("status"); // NO
  return parseStatus(status);
}
```

**The one exception:** `getQueue()` runs an async `playlistinfo` MPD query — it cannot use the cache because the queue is not part of the polled `status` response:

```ts
// CORRECT — getQueue() is the only async read in playerService
export async function getQueue(): Promise<QueueItem[]> {
  const raw = await mpdConnectionManager.executeCommand("playlistinfo");
  return parseQueue(raw);
}
```

Any other read that isn't `getQueue()` should use `getCachedStatus()`. If you find yourself writing a new `await`-based read in `playerService.ts`, stop and reconsider.

---

## Sending commands

All MPD commands go through `mpdConnectionManager.executeCommand()`. After every user-initiated command, call `refreshNow()` so the UI updates immediately without waiting for the next poll tick:

```ts
export async function play(): Promise<void> {
  await mpdConnectionManager.executeCommand("play");
  await mpdConnectionManager.refreshNow(); // triggers immediate poll
}

export async function setVolume(volume: number): Promise<void> {
  await mpdConnectionManager.executeCommand(`setvol ${volume}`);
  await mpdConnectionManager.refreshNow();
}
```

Always `await refreshNow()` — don't fire-and-forget it.

---

## Do not create additional MPD connections

`MpdConnectionManager` owns both TCP connections. Never reach around it:

```ts
// WRONG — creates a rogue MPD connection outside the manager
import mpd from "mpd";
const client = mpd.connect({ host: "localhost", port: 6600 });

// CORRECT — always go through the singleton
import { mpdConnectionManager } from "../services/mpdConnectionManager.js";
await mpdConnectionManager.executeCommand("play");
```

All MPD communication in the backend goes through `mpdConnectionManager`.

---

## Adding a new playback command

Pattern for adding a new command (e.g., `seek`):

1. **playerService.ts** — add the function:
```ts
export async function seek(seconds: number): Promise<void> {
  await mpdConnectionManager.executeCommand(`seekcur ${seconds}`);
  await mpdConnectionManager.refreshNow();
}
```

2. **Controller** — parse input with Zod schema from `@repo/types`, call service:
```ts
import { seekSchema } from "@repo/types/schemas.js";

export const seekController = asyncHandler(async (req, res) => {
  const { seconds } = seekSchema.parse(req.body); // throws ZodError → 400 via errorHandler
  await playerService.seek(seconds);
  res.json({ success: true });
});
```

3. **Route** — wire the controller:
```ts
router.post("/seek", seekController);
```

4. **Schema** — add to `packages/types/src/schemas.ts`:
```ts
export const seekSchema = z.object({ seconds: z.number().min(0) });
```

5. **refreshNow** is called inside the service — the controller doesn't call it again.

---

## Reading cached state in WebSocket handler

The WS handler reads the cache on connect and then listens for `stateChanged` events — it does not poll MPD itself. Broadcasts use `ws/broadcast.ts`:

```ts
import { broadcast } from "./broadcast.js";

// On new client connection — send current state immediately
ws.send(JSON.stringify(mpdConnectionManager.getCachedStatus()));

// Subscribe to subsequent updates
mpdConnectionManager.on("stateChanged", (status: PlaybackStatus) => {
  broadcast(wss, status); // sends to all open clients
});
```

Don't set up your own polling interval in the WS handler — the connection manager handles timing.

---

## Checklist

- [ ] No `await` for status reads in `playerService.ts` — use `getCachedStatus()` (except `getQueue()`)
- [ ] Every command call is followed by `await mpdConnectionManager.refreshNow()`
- [ ] No direct MPD connections created outside `MpdConnectionManager`
- [ ] New schemas defined in `packages/types/src/schemas.ts` and parsed in controllers via `schema.parse()`
- [ ] WS broadcasts use `broadcast.ts`, not manual `ws.send()` loops
