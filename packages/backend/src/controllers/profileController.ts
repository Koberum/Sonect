import { Request, Response } from "express";
import { profileSchemas } from "@repo/types";
import { profilesDb, LastProfileError } from "@repo/db";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { ConflictError, NotFoundError } from "../middleware/errorHandler.js";

function isUniqueConstraintError(err: unknown): boolean {
  for (
    let current: unknown = err;
    current instanceof Error;
    current = (current as Error & { cause?: unknown }).cause
  ) {
    const code = (current as { code?: unknown }).code;
    if (
      code === "ERR_SQLITE_ERROR" &&
      /UNIQUE constraint failed/i.test(current.message)
    ) {
      return true;
    }
  }
  return false;
}

export const getAllProfilesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(profilesDb.getAll());
  },
);

export const createProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, avatarColor } = profileSchemas.create.parse(req.body);
    let id: string;
    try {
      id = profilesDb.create(name, avatarColor);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError(`Profile name "${name}" is already taken`);
      }
      throw err;
    }
    const profile = profilesDb.getById(id);
    if (!profile) throw new Error("Failed to create profile");
    res.status(201).json(profile);
  },
);

export const updateProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = profileSchemas.idParam.parse(req.params);
    const { name, avatarColor } = profileSchemas.update.parse(req.body);

    const existing = profilesDb.getById(id);
    if (!existing) throw new NotFoundError("Profile");

    try {
      if (name !== undefined) profilesDb.rename(id, name);
      if (avatarColor !== undefined) profilesDb.setColor(id, avatarColor);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError(`Profile name "${name}" is already taken`);
      }
      throw err;
    }

    const profile = profilesDb.getById(id);
    if (!profile) throw new Error("Failed to update profile");
    res.json(profile);
  },
);

export const deleteProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = profileSchemas.idParam.parse(req.params);

    const existing = profilesDb.getById(id);
    if (!existing) throw new NotFoundError("Profile");

    if (profilesDb.getAll().length <= 1) {
      throw new ConflictError("Cannot delete the last remaining profile");
    }

    try {
      profilesDb.delete(id);
    } catch (err) {
      if (err instanceof LastProfileError) {
        throw new ConflictError(err.message);
      }
      throw err;
    }

    res.status(204).send();
  },
);
