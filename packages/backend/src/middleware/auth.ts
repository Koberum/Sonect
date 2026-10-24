import type { RequestHandler } from "express";
import type { AuthProfile } from "@repo/types";
import { getAuthService } from "@services/factory";
import { getSessionToken } from "@services/auth/cookies";
import { ForbiddenError, UnauthorizedError } from "./errorHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: {
        profileId: string;
        tokenHash: string;
        profile: AuthProfile;
      };
    }
  }
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = getSessionToken(req);
  if (token) {
    const access = getAuthService().validateSession(token);
    if (access) req.auth = access;
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new UnauthorizedError());
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(new UnauthorizedError());
  if (req.auth.profile.role !== "admin") {
    return next(new ForbiddenError("Admin access required"));
  }
  next();
};
