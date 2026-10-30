import { Request, Response } from "express";
import { likedSchemas } from "@repo/types/schemas";
import { getLikedService } from "@services/factory";
import { resolvePlayerRouter } from "@services/player/playerRouter.js";
import { asyncHandler } from "@middleware/asyncHandler";
import { NotFoundError, ValidationError } from "@middleware/errorHandler";

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export const getLikedHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { limit, offset } = likedSchemas.listQuery.parse(req.query);
    const profileId = req.auth!.profileId;
    res.json(getLikedService().list(profileId, limit, offset));
  },
);

export const getLikedIdsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const profileId = req.auth!.profileId;
    res.json({ ids: getLikedService().ids(profileId) });
  },
);

export const likeTrackHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { trackId } = likedSchemas.trackIdParam.parse(req.params);
    const profileId = req.auth!.profileId;
    const added = getLikedService().add(profileId, trackId);
    if (added === undefined) throw new NotFoundError("Track");
    res.json({ liked: true });
  },
);

export const unlikeTrackHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { trackId } = likedSchemas.trackIdParam.parse(req.params);
    const profileId = req.auth!.profileId;
    getLikedService().remove(profileId, trackId);
    res.json({ liked: false });
  },
);

export const playLikedHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { shuffle } = likedSchemas.play.parse(req.body ?? {});
    const profileId = req.auth!.profileId;
    const files = getLikedService().files(profileId);
    if (files.length === 0) {
      throw new ValidationError("No liked tracks", {});
    }
    const ordered = shuffle ? shuffled(files) : files;
    await resolvePlayerRouter().forSession(profileId).playFiles(ordered, 0);
    res.json({ started: true, count: ordered.length });
  },
);
