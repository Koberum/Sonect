import { Request, Response } from "express";
import { playerSchemas, sessionSchemas, systemSchemas } from "@repo/types";
import { asyncHandler } from "@middleware/asyncHandler";
import { resolvePlayerRouter } from "@services/player/playerRouter.js";
import { LockedError } from "../middleware/errorHandler.js";

function router() {
  return resolvePlayerRouter();
}

export const unifiedGetStatusHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.sessionId as string;
    res.json(router().getStatus(id));
  },
);

export const unifiedPlayHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = playerSchemas.play.parse(req.body);
    if (!file) {
      res.status(400).json({ error: "file is required" });
      return;
    }
    await router()
      .forSession(req.sessionId as string)
      .playTrack(file);
    res.json({ success: true });
  },
);

export const unifiedPauseHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await router()
      .forSession(req.sessionId as string)
      .pause();
    res.json({ success: true });
  },
);

export const unifiedResumeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await router()
      .forSession(req.sessionId as string)
      .resume();
    res.json({ success: true });
  },
);

export const unifiedNextHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await router()
      .forSession(req.sessionId as string)
      .next();
    res.json({ success: true });
  },
);

export const unifiedPreviousHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await router()
      .forSession(req.sessionId as string)
      .previous();
    res.json({ success: true });
  },
);

export const unifiedSeekHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { position } = playerSchemas.position.parse(req.body);
    await router()
      .forSession(req.sessionId as string)
      .seek(position);
    res.json({ success: true });
  },
);

export const unifiedGetQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = await router()
      .forSession(req.sessionId as string)
      .getQueue();
    res.json(q);
  },
);

export const unifiedAddToQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = playerSchemas.addToQueue.parse(req.body);
    await router()
      .forSession(req.sessionId as string)
      .addToQueue(file);
    res.json({ success: true });
  },
);

export const unifiedRemoveFromQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { pos } = sessionSchemas.queuePos.parse(req.params);
    await router()
      .forSession(req.sessionId as string)
      .removeFromQueue(pos);
    res.json({ success: true });
  },
);

export const unifiedMoveQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { from, to } = playerSchemas.moveQueue.parse(req.body);
    await router()
      .forSession(req.sessionId as string)
      .moveQueueItem(from, to);
    res.json({ success: true });
  },
);

export const unifiedPlayPositionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { pos } = playerSchemas.playPosition.parse(req.body);
    await router()
      .forSession(req.sessionId as string)
      .playPosition(pos);
    res.json({ success: true });
  },
);

export const unifiedSetVolumeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { volume } = playerSchemas.volume.parse(req.body);
    await router()
      .forSession(req.sessionId as string)
      .setVolume(volume);
    res.json({ success: true });
  },
);

export const unifiedGetOutputModeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.sessionId as string;
    const r = router();
    res.json({
      mode: r.getMode(id),
      deviceName: r.getOutputDeviceName(),
      mpdOwner: r.getMpdOwner(),
    });
  },
);

export const unifiedSetOutputModeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { mode } = systemSchemas.outputMode.parse(req.body);
    const id = req.sessionId as string;
    const result = router().setMode(id, mode);
    if (!result.success) {
      throw new LockedError(result.warning ?? "MPD locked by another session");
    }
    res.json(result);
  },
);

export const unifiedEnableRandomHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await router()
      .forSession(req.sessionId as string)
      .enableRandom(enabled);
    res.json({ success: true });
  },
);

export const unifiedEnableRepeatHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await router()
      .forSession(req.sessionId as string)
      .enableRepeat(enabled);
    res.json({ success: true });
  },
);
