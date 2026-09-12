import type { Request, Response, NextFunction } from "express";

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
  next();
}
