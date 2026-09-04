import { Request, Response } from "express";
import { playerSchemas } from "@repo/types";
import {
  clearQueue,
  enableConsume,
  enableRandom,
  enableRepeat,
  goToPosition,
  nextTrack,
  pauseTrack,
  playTrack,
  previousTrack,
  setSingle,
  setVolume,
  getQueue,
  playPosition,
  removeFromQueue,
  addToQueue,
  moveQueueItem,
} from "../services/playerService";
import { asyncHandler } from "../middleware/asyncHandler";

export const playTrackHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = playerSchemas.play.parse(req.body);
    await playTrack(file);
    res.json({ message: `Playing track: ${file}` });
  },
);

export const pauseTrackHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    await pauseTrack();
    res.json({ message: "Playback paused" });
  },
);

export const clearQueueHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    await clearQueue();
    res.json({ message: "Queue cleared" });
  },
);

export const goToPositionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { position } = playerSchemas.position.parse(req.body);
    await goToPosition(position);
    res.json({ message: `Moved to position ${position}` });
  },
);

export const setVolumeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { volume } = playerSchemas.volume.parse(req.body);
    await setVolume(volume);
    res.json({ message: `Volume set to ${volume}` });
  },
);

export const nextTrackHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    await nextTrack();
    res.json({ message: "Skipped to next track" });
  },
);

export const previousTrackHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    await previousTrack();
    res.json({ message: "Went back to previous track" });
  },
);

export const enableRepeatHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await enableRepeat(enabled);
    res.json({ message: `Repeat ${enabled ? "enabled" : "disabled"}` });
  },
);

export const enableRandomHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await enableRandom(enabled);
    res.json({ message: `Random ${enabled ? "enabled" : "disabled"}` });
  },
);

export const enableConsumeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await enableConsume(enabled);
    res.json({ message: `Consume ${enabled ? "enabled" : "disabled"}` });
  },
);

export const setSingleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { enabled } = playerSchemas.toggle.parse(req.body);
    await setSingle(enabled);
    res.json({ message: `Single ${enabled ? "enabled" : "disabled"}` });
  },
);

export const getQueueHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const queue = await getQueue();
    res.json(queue);
  },
);

export const playPositionHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { pos } = playerSchemas.playPosition.parse(req.body);
    await playPosition(pos);
    res.json({ message: `Playing queue position ${pos}` });
  },
);

export const removeFromQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { pos } = playerSchemas.queuePos.parse(req.body);
    await removeFromQueue(pos);
    res.json({ message: `Removed queue position ${pos}` });
  },
);

export const addToQueueHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { file } = playerSchemas.addToQueue.parse(req.body);
    await addToQueue(file);
    res.json({ message: `Added to queue: ${file}` });
  },
);

export const moveQueueItemHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { from, to } = playerSchemas.moveQueue.parse(req.body);
    await moveQueueItem(from, to);
    res.json({ message: `Moved queue item from ${from} to ${to}` });
  },
);
