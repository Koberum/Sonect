import type { Request, Response, NextFunction } from "express";
import { getMpdConfigService } from "@services/factory";
import { LockedError } from "./errorHandler";

export function mpdLockMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.method === "GET") {
    next();
    return;
  }
  const sessionId = req.header("X-Session-Id")?.trim();
  // No session id -> no lock enforcement (backward compat for non-session clients / tests)
  if (!sessionId) {
    next();
    return;
  }
  const svc = getMpdConfigService();
  const owner = svc.getMpdOwner();
  if (owner === null) {
    // First session to touch MPD acquires the lock
    svc.tryAcquireMpd(sessionId);
    next();
    return;
  }
  if (owner === sessionId) {
    next();
    return;
  }
  // Locked by another session
  next(new LockedError(`MPD output locked by another session`));
}
