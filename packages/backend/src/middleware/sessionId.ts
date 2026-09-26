import type { Request, Response, NextFunction } from "express";

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
  const dName = req.header("X-Device-Name")?.trim() ?? null;
  req.deviceName = dName && dName.length > 0 ? dName : null;
  const dType = req.header("X-Device-Type")?.trim() ?? null;
  req.deviceType = dType && dType.length > 0 ? dType : null;
  next();
}
