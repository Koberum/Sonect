import type { Request, Response } from "express";
import { authSchemas } from "@repo/types";
import { asyncHandler } from "@middleware/asyncHandler";
import { UnauthorizedError } from "@middleware/errorHandler";
import {
  getAuthService,
  getMpdConfigService,
  getProfileService,
} from "@services/factory";
import {
  clearSessionCookie,
  getSessionToken,
  setSessionCookie,
} from "@services/auth/cookies";
import type { SessionMeta } from "@services/auth/authService.js";

function meta(req: Request): SessionMeta {
  return {
    userAgent: req.header("user-agent") ?? null,
    deviceId: req.header("X-Device-Id")?.trim() || null,
  };
}

export const getAuthStateHandler = asyncHandler(
  async (req: Request, res: Response) => {
    res.json(getAuthService().getState(getSessionToken(req)));
  },
);

export const getAuthProfilesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(getProfileService().getPublicProfiles());
  },
);

export const bootstrapHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = authSchemas.bootstrap.parse(req.body);
    const result = await getAuthService().bootstrap(input, meta(req));
    setSessionCookie(res, result.token);
    res.status(201).json({ profile: result.profile });
  },
);

export const loginHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const input = authSchemas.login.parse(req.body);
    const result = await getAuthService().login(
      input.profileId,
      input.password,
      meta(req),
    );
    setSessionCookie(res, result.token);
    res.json({ profile: result.profile });
  },
);

export const logoutHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const token = getSessionToken(req);
    if (!token) throw new UnauthorizedError();
    const result = getAuthService().logout(token);
    clearSessionCookie(res);
    if (result && result.remainingSessions === 0) {
      getMpdConfigService().releaseMpd(result.profileId);
    }
    res.status(204).send();
  },
);

export const switchProfileHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const token = getSessionToken(req);
    if (!token) throw new UnauthorizedError();
    const input = authSchemas.switchProfile.parse(req.body);
    const result = await getAuthService().switchProfile(
      token,
      input.profileId,
      input.password,
      meta(req),
    );
    setSessionCookie(res, result.result.token);
    if (result.previousRemainingSessions === 0) {
      getMpdConfigService().releaseMpd(result.previousProfileId);
    }
    res.json({ profile: result.result.profile });
  },
);

export const changePasswordHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const auth = req.auth;
    if (!auth) throw new UnauthorizedError();
    const input = authSchemas.changePassword.parse(req.body);
    await getAuthService().changePassword(
      auth.profileId,
      auth.tokenHash,
      input.currentPassword,
      input.newPassword,
    );
    res.status(204).send();
  },
);
