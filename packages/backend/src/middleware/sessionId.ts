import type { Request, Response, NextFunction } from "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      sessionId?: string;
      deviceId?: string | null;
    }
  }
}

export function sessionIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const id = req.header("X-Session-Id");
  if (!id || id.trim() === "") {
    res.status(400).json({ error: "X-Session-Id header is required" });
    return;
  }
  req.sessionId = id.trim();
  const did = req.header("X-Device-Id")?.trim() ?? null;
  req.deviceId = did && did.length > 0 ? did : null;
  next();
}
