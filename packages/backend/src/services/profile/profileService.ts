import { profilesDb, authSessionsDb, LastAdminError } from "@repo/db";
import { toProfile, toPublicProfile } from "@repo/types";
import type {
  DBProfile,
  Profile,
  ProfileRole,
  PublicProfile,
} from "@repo/types";
import { ConflictError } from "@middleware/errorHandler.js";
import { hashPassword } from "@services/auth/password.js";

export interface ProfileService {
  getAllProfiles(): Profile[];
  getPublicProfiles(): PublicProfile[];
  createProfile(input: {
    name: string;
    avatarColor?: string;
    password: string;
    role?: ProfileRole;
  }): Promise<Profile>;
  updateProfile(
    id: string,
    data: { name?: string; avatarColor?: string; role?: ProfileRole },
  ): Profile | undefined;
  resetProfilePassword(id: string, password: string): Promise<boolean>;
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

  public getPublicProfiles(): PublicProfile[] {
    return profilesDb.getAll().map(toPublicProfile);
  }

  public async createProfile(input: {
    name: string;
    avatarColor?: string;
    password: string;
    role?: ProfileRole;
  }): Promise<Profile> {
    const passwordHash = await hashPassword(input.password);
    let id: string;
    try {
      id = profilesDb.create({
        name: input.name,
        avatarColor: input.avatarColor,
        passwordHash,
        role: input.role,
      });
    } catch (err) {
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictError(
          `Profile name "${input.name}" is already taken`,
        );
      }
      throw err;
    }
    const profile = profilesDb.getById(id);
    if (!profile) throw new Error("Failed to create profile");
    return this.mapProfile(profile);
  }

  public updateProfile(
    id: string,
    data: { name?: string; avatarColor?: string; role?: ProfileRole },
  ): Profile | undefined {
    const existing = profilesDb.getById(id);
    if (!existing) return undefined;

    try {
      profilesDb.update(id, data);
    } catch (err) {
      if (err instanceof LastAdminError) {
        throw new ConflictError(err.message);
      }
      if (this.isUniqueConstraintError(err)) {
        throw new ConflictError(`Profile name "${data.name}" is already taken`);
      }
      throw err;
    }

    const profile = profilesDb.getById(id);
    if (!profile) throw new Error("Failed to update profile");
    return this.mapProfile(profile);
  }

  public async resetProfilePassword(
    id: string,
    password: string,
  ): Promise<boolean> {
    const existing = profilesDb.getById(id);
    if (!existing) return false;
    profilesDb.setPassword(id, await hashPassword(password));
    authSessionsDb.deleteByProfile(id);
    return true;
  }

  public deleteProfile(id: string): boolean {
    const existing = profilesDb.getById(id);
    if (!existing) return false;

    try {
      profilesDb.delete(id);
    } catch (err) {
      if (err instanceof LastAdminError) {
        throw new ConflictError(err.message);
      }
      throw err;
    }

    return true;
  }
}
