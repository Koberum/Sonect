import type { CookieOptions, Request, Response } from "express";
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from "./constants.js";

export function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  }
  return cookies;
}

export function getSessionTokenFromCookieHeader(
  cookie?: string,
): string | undefined {
  return parseCookies(cookie)[SESSION_COOKIE_NAME];
}

export function getSessionToken(req: Request): string | undefined {
  return getSessionTokenFromCookieHeader(req.headers.cookie);
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
    secure: process.env.COOKIE_SECURE === "true",
  };
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, sessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.COOKIE_SECURE === "true",
  });
}
