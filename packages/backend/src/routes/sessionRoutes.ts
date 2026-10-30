import { Router } from "express";
import { requireAuth } from "@middleware/auth";
import { sessionIdMiddleware } from "@middleware/sessionId";
import {
  getSessionStatusHandler,
  sessionSeekHandler,
  sessionQueueGetHandler,
  sessionQueueAddHandler,
  sessionQueueRemoveHandler,
  sessionQueueMoveHandler,
  sessionPlayHandler,
  sessionPauseHandler,
  sessionResumeHandler,
  sessionNextHandler,
  sessionPreviousHandler,
} from "../controllers/sessionController";

const router = Router();
router.use(requireAuth, sessionIdMiddleware);
router.get("/status", getSessionStatusHandler);
router.get("/queue", sessionQueueGetHandler);
router.post("/queue", sessionQueueAddHandler);
router.delete("/queue/:pos", sessionQueueRemoveHandler);
router.post("/queue/move", sessionQueueMoveHandler);
router.post("/player/play", sessionPlayHandler);
router.post("/player/pause", sessionPauseHandler);
router.post("/player/resume", sessionResumeHandler);
router.post("/player/next", sessionNextHandler);
router.post("/player/previous", sessionPreviousHandler);
router.post("/player/seek", sessionSeekHandler);

export default router;
