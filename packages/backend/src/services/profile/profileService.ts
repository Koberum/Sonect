import { profilesDb, LastProfileError } from "@repo/db";
import { toProfile } from "@repo/types";
import type { DBProfile, Profile } from "@repo/types";
import { ConflictError } from "@middleware/errorHandler.js";

export interface ProfileService {
  getAllProfiles(): Profile[];
  getProfileById(id: string): Profile | undefined;
  createProfile(name: string, avatarColor?: string): Profile;
  updateProfile(
    id: string,
    data: { name?: string; avatarColor?: string },
  ): Profile | undefined;
  deleteProfile(id: string): boolean;
}

export class ProfileServiceImpl implements ProfileService {
  private mapProfile(dbProfile: DBProfile): Profile {
    return toProfile(dbProfile);
  }

  private isUniqueConstraintError(err: unknown): boolean {
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

  public getAllProfiles(): Profile[] {
    return profilesDb.getAll().map((p) => this.mapProfile(p));
  }

  public getProfileById(id: string): Profile | undefined {
    const row = profilesDb.getById(id);
    return row ? this.mapProfile(row) : undefined;
  }

  public createProfile(name: string, avatarColor?: string): Profile {
    let id: string;
    try {
      id = profilesDb.create(name, avatarColor);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictError(`Profile name "${name}" is already taken`);
      }
      throw err;
    }
    const profile = profilesDb.getById(id);
    if (!profile) throw new Error("Failed to create profile");
    return this.mapProfile(profile);
  }

  public updateProfile(
    id: string,
    data: { name?: string; avatarColor?: string },
  ): Profile | undefined {
    const existing = profilesDb.getById(id);
    if (!existing) return undefined;

    try {
      if (data.name !== undefined) profilesDb.rename(id, data.name);
      if (data.avatarColor !== undefined)
        profilesDb.setColor(id, data.avatarColor);
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictError(`Profile name "${data.name}" is already taken`);
      }
      throw err;
    }

    const profile = profilesDb.getById(id);
    if (!profile) throw new Error("Failed to update profile");
    return this.mapProfile(profile);
  }

  public deleteProfile(id: string): boolean {
    const existing = profilesDb.getById(id);
    if (!existing) return false;

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

    return true;
  }
}
