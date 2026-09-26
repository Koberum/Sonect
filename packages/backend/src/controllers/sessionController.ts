import { Request, Response } from "express";
import { sessionSchemas } from "@repo/types";
import { asyncHandler } from "@middleware/asyncHandler";
import { resolveSessionRegistry } from "@services/session/sessionRegistry.js";

// Sessions are idempotent: the first REST/WS touch creates the session, and
// every later touch reuses it (spec: client-generated identity).
function sessionFrom(req: Request) {
  const registry = resolveSessionRegistry();
  const id = req.sessionId as string;
  return registry.getOrCreateSession(id);
}

export const getSessionStatusHandler = asyncHandler(
  async (req: Request, res: Response) => {
    res.json(sessionFrom(req).getStatus());
  },
);

export const sessionPlayHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = sessionSchemas.play.parse(req.body);
    const s = sessionFrom(req);
    s?.playTrack(file);
    res.json({ success: true });
  },
);

export const sessionPauseHandler = asyncHandler(
  async (req: Request, res: Response) => {
    sessionFrom(req).pause();
    res.json({ success: true });
  },
);

export const sessionResumeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    sessionFrom(req).resume();
    res.json({ success: true });
  },
);

export const sessionNextHandler = asyncHandler(
  async (req: Request, res: Response) => {
    sessionFrom(req).next();
    res.json({ success: true });
  },
);

export const sessionPreviousHandler = asyncHandler(
  async (req: Request, res: Response) => {
    sessionFrom(req).previous();
    res.json({ success: true });
  },
);

export const sessionSeekHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { position } = sessionSchemas.position.parse(req.body);
    sessionFrom(req).seek(position);
    res.json({ success: true });
  },
);

export const sessionQueueGetHandler = asyncHandler(
  async (req: Request, res: Response) => {
    res.json(sessionFrom(req).getQueue());
  },
);

export const sessionQueueAddHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = sessionSchemas.play.parse(req.body);
    sessionFrom(req).addToQueue(file);
    res.json({ success: true });
  },
);

export const sessionQueueRemoveHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { pos } = sessionSchemas.queuePos.parse(req.params);
    sessionFrom(req).removeFromQueue(pos);
    res.json({ success: true });
  },
);

export const sessionQueueMoveHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { from, to } = sessionSchemas.moveQueue.parse(req.body);
    sessionFrom(req).moveQueueItem(from, to);
    res.json({ success: true });
  },
);
