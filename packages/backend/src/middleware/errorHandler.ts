import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { pushLog } from "../services/logService";

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const statusCode = err instanceof ZodError ? 400 : (err.statusCode ?? 500);

  pushLog(
    statusCode >= 500 ? "error" : "warn",
    `Error ${statusCode}: ${err.message}`,
    {
      method: _req.method,
      url: _req.originalUrl,
      statusCode,
      stack: err.stack?.split("\n").slice(0, 3).join(" → "),
    },
  );

  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      details: err.flatten().fieldErrors,
    });
    return;
  }
  const body: Record<string, unknown> = { error: err.message };
  if (err.details !== undefined) {
    body.details = err.details;
  }
  res.status(statusCode).json(body);
}

export class ValidationError extends Error {
  statusCode = 400;
  details: unknown;

  constructor(message: string, details: unknown) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
  }
}

export class NotFoundError extends Error {
  statusCode = 404;

  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = "NotFoundError";
  }
}
