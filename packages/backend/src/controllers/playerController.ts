import { Request, Response } from "express";
import { playerSchemas } from "@repo/types";
import { getPlayerService } from "@services/factory";
import { asyncHandler } from "@middleware/asyncHandler";

export const playTrackHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = playerSchemas.play.parse(req.body);
    await getPlayerService().playTrack(file);
    res.json({ message: `Playing track: ${file}` });
  },
);

export const pauseTrackHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    await getPlayerService().pauseTrack();
    res.json({ message: "Playback paused" });
  },
);

export const clearQueueHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    await getPlayerService().clearQueue();
    res.json({ message: "Queue cleared" });
  },
);

export const goToPositionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { position } = playerSchemas.position.parse(req.body);
    await getPlayerService().goToPosition(position);
    res.json({ message: `Moved to position ${position}` });
  },
);

export const setVolumeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { volume } = playerSchemas.volume.parse(req.body);
    await getPlayerService().setVolume(volume);
    res.json({ message: `Volume set to ${volume}` });
  },
);

export const nextTrackHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    await getPlayerService().nextTrack();
    res.json({ message: "Skipped to next track" });
  },
);

export const previousTrackHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    await getPlayerService().previousTrack();
    res.json({ message: "Went back to previous track" });
  },
);

export const enableRepeatHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await getPlayerService().enableRepeat(enabled);
    res.json({ message: `Repeat ${enabled ? "enabled" : "disabled"}` });
  },
);

export const enableRandomHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await getPlayerService().enableRandom(enabled);
    res.json({ message: `Random ${enabled ? "enabled" : "disabled"}` });
  },
);

export const enableConsumeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await getPlayerService().enableConsume(enabled);
    res.json({ message: `Consume ${enabled ? "enabled" : "disabled"}` });
  },
);

export const setSingleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await getPlayerService().setSingle(enabled);
    res.json({ message: `Single ${enabled ? "enabled" : "disabled"}` });
  },
);

export const getQueueHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const queue = await getPlayerService().getQueue();
    res.json(queue);
  },
);

export const playPositionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { pos } = playerSchemas.playPosition.parse(req.body);
    await getPlayerService().playPosition(pos);
    res.json({ message: `Playing queue position ${pos}` });
  },
);

export const removeFromQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { pos } = playerSchemas.queuePos.parse(req.body);
    await getPlayerService().removeFromQueue(pos);
    res.json({ message: `Removed queue position ${pos}` });
  },
);

export const addToQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = playerSchemas.addToQueue.parse(req.body);
    await getPlayerService().addToQueue(file);
    res.json({ message: `Added to queue: ${file}` });
  },
);

export const moveQueueItemHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { from, to } = playerSchemas.moveQueue.parse(req.body);
    await getPlayerService().moveQueueItem(from, to);
    res.json({ message: `Moved queue item from ${from} to ${to}` });
  },
);
