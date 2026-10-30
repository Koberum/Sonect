import { Request, Response } from "express";
import { profileSchemas } from "@repo/types";
import { getMpdConfigService, getProfileService } from "@services/factory.js";
import { asyncHandler } from "@middleware/asyncHandler.js";
import { NotFoundError } from "@middleware/errorHandler.js";
import { closeProfileSockets } from "../ws/socketRegistry.js";

export const getAllProfilesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(getProfileService().getAllProfiles());
  },
);

export const createProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, avatarColor, password, role } = profileSchemas.create.parse(
      req.body,
    );
    const profile = await getProfileService().createProfile({
      name,
      avatarColor,
      password,
      role,
    });
    res.status(201).json(profile);
  },
);

export const updateProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = profileSchemas.idParam.parse(req.params);
    const { name, avatarColor, role } = profileSchemas.update.parse(req.body);
    const profile = getProfileService().updateProfile(id, {
      name,
      avatarColor,
      role,
    });
    if (!profile) throw new NotFoundError("Profile");
    res.json(profile);
  },
);

export const resetProfilePasswordHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = profileSchemas.idParam.parse(req.params);
    const { password } = profileSchemas.resetPassword.parse(req.body);
    const updated = await getProfileService().resetProfilePassword(
      id,
      password,
    );
    if (!updated) throw new NotFoundError("Profile");
    getMpdConfigService().releaseMpd(id);
    closeProfileSockets(id);
    res.status(204).send();
  },
);

export const deleteProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = profileSchemas.idParam.parse(req.params);
    const deleted = getProfileService().deleteProfile(id);
    if (!deleted) throw new NotFoundError("Profile");
    getMpdConfigService().releaseMpd(id);
    closeProfileSockets(id);
    res.status(204).send();
  },
);
