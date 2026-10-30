import { authSessionsDb, profilesDb } from "@repo/db";
import {
  toAuthProfile,
  type AuthProfile,
  type AuthState,
  type DBProfile,
} from "@repo/types";
import {
  ConflictError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@middleware/errorHandler.js";
import { SESSION_TTL_MS } from "./constants.js";
import { LoginThrottle } from "./loginThrottle.js";
import { hashPassword, verifyPassword } from "./password.js";
import { generateSessionToken, hashSessionToken } from "./tokens.js";

export type SessionMeta = {
  userAgent?: string | null;
  deviceId?: string | null;
};

export type AuthAccess = {
  profileId: string;
  tokenHash: string;
  profile: AuthProfile;
};

export type AuthResult = {
  token: string;
  profile: AuthProfile;
};

export interface AuthService {
  getState(token?: string): AuthState;
  bootstrap(
    input: { name: string; password: string },
    meta?: SessionMeta,
  ): Promise<AuthResult>;
  login(
    profileId: string,
    password: string,
    meta?: SessionMeta,
  ): Promise<AuthResult>;
  logout(
    token: string,
  ): { profileId: string; remainingSessions: number } | null;
  switchProfile(
    token: string,
    profileId: string,
    password: string,
    meta?: SessionMeta,
  ): Promise<{
    result: AuthResult;
    previousProfileId: string;
    previousRemainingSessions: number;
  }>;
  changePassword(
    profileId: string,
    currentTokenHash: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void>;
  resetPassword(profileId: string, newPassword: string): Promise<void>;
  validateSession(token: string): AuthAccess | null;
}

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

export class AuthServiceImpl implements AuthService {
  constructor(
    private readonly throttle = new LoginThrottle(),
    private readonly now: () => number = () => Date.now(),
  ) {}

  public getState(token?: string): AuthState {
    const bootstrapRequired = profilesDb.countAdmins() === 0;
    if (!token) {
      return { bootstrapRequired, authenticated: false, profile: null };
    }
    const access = this.validateSession(token);
    return {
      bootstrapRequired,
      authenticated: access !== null,
      profile: access?.profile ?? null,
    };
  }

  public async bootstrap(
    input: { name: string; password: string },
    meta: SessionMeta = {},
  ): Promise<AuthResult> {
    if (profilesDb.countAdmins() > 0) {
      throw new ConflictError("Setup already completed");
    }
    const passwordHash = await hashPassword(input.password);
    // Re-check after the async hash: two concurrent bootstraps can both pass the
    // pre-check above. Nothing awaits between this check and create(), so in the
    // single-process runtime exactly one caller can win.
    if (profilesDb.countAdmins() > 0) {
      throw new ConflictError("Setup already completed");
    }
    let id: string;
    try {
      id = profilesDb.create({
        name: input.name,
        passwordHash,
        role: "admin",
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError(
          `Profile name "${input.name}" is already taken`,
        );
      }
      throw err;
    }
    const profile = profilesDb.getById(id);
    if (!profile) throw new Error("Failed to create admin profile");
    return this.issueSession(profile, meta);
  }

  public async login(
    profileId: string,
    password: string,
    meta: SessionMeta = {},
  ): Promise<AuthResult> {
    const gate = this.throttle.check(profileId);
    if (!gate.allowed) {
      throw new TooManyRequestsError(gate.retryAfterSeconds);
    }
    const profile = profilesDb.getById(profileId);
    if (!profile?.password_hash) {
      this.throttle.recordFailure(profileId);
      throw new UnauthorizedError("Invalid profile or password");
    }
    const valid = await verifyPassword(password, profile.password_hash);
    if (!valid) {
      this.throttle.recordFailure(profileId);
      throw new UnauthorizedError("Invalid profile or password");
    }
    this.throttle.reset(profileId);
    return this.issueSession(profile, meta);
  }

  public logout(
    token: string,
  ): { profileId: string; remainingSessions: number } | null {
    const tokenHash = hashSessionToken(token);
    const session = authSessionsDb.getByTokenHash(tokenHash);
    if (!session) return null;
    authSessionsDb.delete(tokenHash);
    return {
      profileId: session.profile_id,
      remainingSessions: authSessionsDb.countActiveByProfile(
        session.profile_id,
        this.now(),
      ),
    };
  }

  public async switchProfile(
    token: string,
    profileId: string,
    password: string,
    meta: SessionMeta = {},
  ): Promise<{
    result: AuthResult;
    previousProfileId: string;
    previousRemainingSessions: number;
  }> {
    const tokenHash = hashSessionToken(token);
    const now = this.now();
    const current = authSessionsDb.findValid(tokenHash, now);
    if (!current) throw new UnauthorizedError();

    const gate = this.throttle.check(profileId);
    if (!gate.allowed) {
      throw new TooManyRequestsError(gate.retryAfterSeconds);
    }
    const target = profilesDb.getById(profileId);
    if (!target?.password_hash) {
      this.throttle.recordFailure(profileId);
      throw new UnauthorizedError("Invalid password");
    }
    const valid = await verifyPassword(password, target.password_hash);
    if (!valid) {
      this.throttle.recordFailure(profileId);
      throw new UnauthorizedError("Invalid password");
    }
    this.throttle.reset(profileId);

    authSessionsDb.delete(tokenHash);
    const result = this.issueSession(target, meta);
    return {
      result,
      previousProfileId: current.profile_id,
      previousRemainingSessions: authSessionsDb.countActiveByProfile(
        current.profile_id,
        now,
      ),
    };
  }

  public async changePassword(
    profileId: string,
    currentTokenHash: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const profile = profilesDb.getById(profileId);
    if (!profile?.password_hash) throw new NotFoundError("Profile");
    const valid = await verifyPassword(currentPassword, profile.password_hash);
    if (!valid) {
      throw new UnauthorizedError("Current password is incorrect");
    }
    profilesDb.setPassword(profileId, await hashPassword(newPassword));
    authSessionsDb.deleteOtherSessions(profileId, currentTokenHash);
  }

  public async resetPassword(
    profileId: string,
    newPassword: string,
  ): Promise<void> {
    const profile = profilesDb.getById(profileId);
    if (!profile) throw new NotFoundError("Profile");
    profilesDb.setPassword(profileId, await hashPassword(newPassword));
    authSessionsDb.deleteByProfile(profileId);
  }

  public validateSession(token: string): AuthAccess | null {
    const tokenHash = hashSessionToken(token);
    const now = this.now();
    const session = authSessionsDb.findValid(tokenHash, now);
    if (!session) return null;
    const profile = profilesDb.getById(session.profile_id);
    if (!profile) return null;
    if (now - session.last_used_at > 5 * 60_000) {
      authSessionsDb.touch(tokenHash, now);
    }
    return {
      profileId: profile.id,
      tokenHash,
      profile: toAuthProfile(profile),
    };
  }

  private issueSession(profile: DBProfile, meta: SessionMeta): AuthResult {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const now = this.now();
    authSessionsDb.create({
      token_hash: tokenHash,
      profile_id: profile.id,
      created_at: now,
      expires_at: now + SESSION_TTL_MS,
      last_used_at: now,
      user_agent: meta.userAgent ?? null,
      device_id: meta.deviceId ?? null,
    });
    return { token, profile: toAuthProfile(profile) };
  }
}
