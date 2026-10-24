import type { Request, Response, NextFunction } from "express";
import { ForbiddenError, UnauthorizedError } from "./errorHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionId?: string;
      deviceId?: string | null;
      deviceName?: string | null;
      deviceType?: string | null;
    }
  }
}

export function sessionIdMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.auth) {
    next(new UnauthorizedError());
    return;
  }
  const headerSessionId = req.header("X-Session-Id")?.trim();
  if (headerSessionId && headerSessionId !== req.auth.profileId) {
    next(
      new ForbiddenError("Session does not match the authenticated profile"),
    );
    return;
  }
  req.sessionId = req.auth.profileId;
  const did = req.header("X-Device-Id")?.trim() ?? null;
  req.deviceId = did && did.length > 0 ? did : null;
  const dName = req.header("X-Device-Name")?.trim() ?? null;
  req.deviceName = dName && dName.length > 0 ? dName : null;
  const dType = req.header("X-Device-Type")?.trim() ?? null;
  req.deviceType = dType && dType.length > 0 ? dType : null;
  next();
}
