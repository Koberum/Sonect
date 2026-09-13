import { Router } from "express";
import { sessionIdMiddleware } from "@middleware/sessionId";
import {
  unifiedGetStatusHandler,
  unifiedPlayHandler,
  unifiedPauseHandler,
  unifiedResumeHandler,
  unifiedNextHandler,
  unifiedPreviousHandler,
  unifiedSeekHandler,
  unifiedGetQueueHandler,
  unifiedAddToQueueHandler,
  unifiedRemoveFromQueueHandler,
  unifiedMoveQueueHandler,
  unifiedPlayPositionHandler,
  unifiedSetVolumeHandler,
  unifiedGetOutputModeHandler,
  unifiedSetOutputModeHandler,
  unifiedEnableRandomHandler,
  unifiedEnableRepeatHandler,
} from "../controllers/unifiedPlayerController.js";

const router = Router();
router.use(sessionIdMiddleware);

router.get("/status", unifiedGetStatusHandler);
router.get("/queue", unifiedGetQueueHandler);
router.post("/play", unifiedPlayHandler);
router.post("/pause", unifiedPauseHandler);
router.post("/resume", unifiedResumeHandler);
router.post("/next", unifiedNextHandler);
router.post("/previous", unifiedPreviousHandler);
router.post("/seek", unifiedSeekHandler);
router.post("/queue", unifiedAddToQueueHandler);
router.delete("/queue/:pos", unifiedRemoveFromQueueHandler);
router.post("/queue/move", unifiedMoveQueueHandler);
router.post("/play-position", unifiedPlayPositionHandler);
router.patch("/volume", unifiedSetVolumeHandler);
router.post("/random", unifiedEnableRandomHandler);
router.post("/repeat", unifiedEnableRepeatHandler);
router.get("/output-mode", unifiedGetOutputModeHandler);
router.put("/output-mode", unifiedSetOutputModeHandler);

export default router;
