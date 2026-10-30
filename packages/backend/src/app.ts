import express from "express";
import path from "path";
import fs from "fs";
import catalogRoutes from "@routes/catalogRoutes";
import playlistRoutes from "@routes/playlistRoutes";
import systemRoutes from "@routes/systemRoutes";
import streamRoutes from "@routes/streamRoutes";
import waveformRoutes from "@routes/waveformRoutes";
import dashboardRouter from "@routes/dashboardRoutes";
import sessionRoutes from "@routes/sessionRoutes";
import unifiedPlayerRoutes from "@routes/unifiedPlayerRoutes";
import profileRoutes from "@routes/profileRoutes";
import authRoutes from "@routes/authRoutes";
import likedRoutes from "@routes/likedRoutes";
import { errorHandler } from "@middleware/errorHandler";
import { requestLogger } from "@middleware/requestLogger";
import { authenticate, requireAuth } from "@middleware/auth";
import { getLogService } from "@services/factory";

const app = express();

const apiPaths = [
  "/covers",
  "/stream",
  "/waveforms",
  "/player",
  "/catalog",
  "/playlists",
  "/system",
  "/dashboard",
  "/session",
  "/profiles",
  "/auth",
  "/likes",
];

function configuredCorsOrigins(): string[] {
  return (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return value.replace(/\/$/, "");
      }
    });
}

app.use(requestLogger);

app.use((req, res, next) => {
  const origin = req.header("Origin");
  res.header("Vary", "Origin");
  if (origin) {
    try {
      const requestOrigin = new URL(origin).origin;
      if (configuredCorsOrigins().includes(requestOrigin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
      }
    } catch {
      // Malformed Origin: do not send CORS headers.
    }
  }
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Session-Id, X-Device-Id, X-Device-Name, X-Device-Type",
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json());

app.use(apiPaths, authenticate);

app.use(
  "/covers",
  requireAuth,
  express.static(process.env.COVERS_DIR || "@data/covers", {
    maxAge: "30d",
    immutable: true,
  }),
);

app.use("/auth", authRoutes);

app.use("/stream", streamRoutes);
app.use("/waveforms", waveformRoutes);

app.use("/player", unifiedPlayerRoutes);
app.use("/catalog", catalogRoutes);
app.use("/playlists", playlistRoutes);
app.use("/system", systemRoutes);
app.use("/dashboard", dashboardRouter);
app.use("/session", sessionRoutes);
app.use("/profiles", profileRoutes);
app.use("/likes", likedRoutes);

// In production, serve the built frontend from the same process
const frontendDist =
  process.env.FRONTEND_DIST || path.resolve(process.cwd(), "@frontend/dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist, { maxAge: "30d", immutable: true }));
  app.get("/{*path}", (req, res, next) => {
    if (
      req.path.startsWith("/player") ||
      req.path.startsWith("/catalog") ||
      req.path.startsWith("/playlists") ||
      req.path.startsWith("/covers") ||
      req.path.startsWith("/waveforms") ||
      req.path.startsWith("/system") ||
      req.path.startsWith("/stream") ||
      req.path.startsWith("/dashboard") ||
      req.path.startsWith("/session") ||
      req.path.startsWith("/profiles") ||
      req.path.startsWith("/auth") ||
      req.path.startsWith("/likes")
    ) {
      return next();
    }
    getLogService().pushLog("debug", `SPA fallback: ${req.path}`);
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.use(errorHandler);

export default app;
