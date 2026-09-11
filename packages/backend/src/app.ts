import express from "express";
import path from "path";
import fs from "fs";
import playerRoutes from "@routes/playerRoutes";
import libraryRoutes from "@routes/libraryRoutes";
import playlistRoutes from "@routes/playlistRoutes";
import systemRoutes from "@routes/systemRoutes";
import streamRoutes from "@routes/streamRoutes";
import dashboardRouter from "@routes/dashboardRoutes";
import { errorHandler } from "@middleware/errorHandler";
import { requestLogger } from "@middleware/requestLogger";
import { getLogService } from "@services/factory";

const app = express();

app.use(requestLogger);

app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, DELETE, OPTIONS",
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (_req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json());

app.use(
  "/covers",
  express.static(process.env.COVERS_DIR || "@data/covers", {
    maxAge: "30d",
    immutable: true,
  }),
);

app.use("/stream", streamRoutes);

app.use("/mpd", playerRoutes);
app.use("/library", libraryRoutes);
app.use("/playlists", playlistRoutes);
app.use("/system", systemRoutes);
app.use("/dashboard", dashboardRouter);

// In production, serve the built frontend from the same process
const frontendDist =
  process.env.FRONTEND_DIST || path.resolve(process.cwd(), "@frontend/dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(frontendDist)) {
  getLogService().pushLog("info", `Serving frontend from ${frontendDist}`);
  app.use(express.static(frontendDist, { maxAge: "30d", immutable: true }));
  app.get("/{*path}", (req, res, next) => {
    if (
      req.path.startsWith("/mpd") ||
      req.path.startsWith("/library") ||
      req.path.startsWith("/playlists") ||
      req.path.startsWith("/covers") ||
      req.path.startsWith("/system") ||
      req.path.startsWith("/stream") ||
      req.path.startsWith("/dashboard")
    ) {
      return next();
    }
    getLogService().pushLog("debug", `SPA fallback: ${req.path}`);
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else if (process.env.NODE_ENV === "production") {
  getLogService().pushLog("warn", `Frontend dist not found at ${frontendDist}`);
}

app.use(errorHandler);

export default app;
