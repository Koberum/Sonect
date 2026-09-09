import { Request, Response, NextFunction } from "express";
import { pushLog } from "../services/utils/logService";

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    const level =
      res.statusCode >= 500
        ? "error"
        : res.statusCode >= 400
          ? "warn"
          : "debug";

    if (level === "error" || level === "warn") {
      pushLog(level, message, {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
      });
    } else {
      pushLog(level, message);
    }
  });

  next();
}
