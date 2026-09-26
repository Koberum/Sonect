import { Request, Response } from "express";
import { profileSchemas } from "@repo/types";
import { getProfileService } from "@services/factory.js";
import { asyncHandler } from "@middleware/asyncHandler.js";
import { NotFoundError } from "@middleware/errorHandler.js";

export const getAllProfilesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(getProfileService().getAllProfiles());
  },
);

export const createProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, avatarColor } = profileSchemas.create.parse(req.body);
    const profile = getProfileService().createProfile(name, avatarColor);
    res.status(201).json(profile);
  },
);

export const updateProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = profileSchemas.idParam.parse(req.params);
    const { name, avatarColor } = profileSchemas.update.parse(req.body);
    const profile = getProfileService().updateProfile(id, {
      name,
      avatarColor,
    });
    if (!profile) throw new NotFoundError("Profile");
    res.json(profile);
  },
);

export const deleteProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = profileSchemas.idParam.parse(req.params);
    const deleted = getProfileService().deleteProfile(id);
    if (!deleted) throw new NotFoundError("Profile");
    res.status(204).send();
  },
);
