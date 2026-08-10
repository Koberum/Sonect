import { Router } from "express";
import {
  clearQueueHandler,
  enableConsumeHandler,
  enableRandomHandler,
  enableRepeatHandler,
  goToPositionHandler,
  nextTrackHandler,
  pauseTrackHandler,
  playTrackHandler,
  previousTrackHandler,
  setAutoplayHandler,
  setSingleHandler,
  setVolumeHandler,
  getAutoplayStatusHandler,
  getQueueHandler,
  playPositionHandler,
  removeFromQueueHandler,
  addToQueueHandler,
  moveQueueItemHandler,
} from "../controllers/playerController";

const router = Router();

router.post("/play", playTrackHandler);
router.post("/pause", pauseTrackHandler);
router.post("/position", goToPositionHandler);
router.post("/next", nextTrackHandler);
router.post("/previous", previousTrackHandler);
router.post("/repeat", enableRepeatHandler);
router.post("/random", enableRandomHandler);
router.post("/consume", enableConsumeHandler);
router.post("/single", setSingleHandler);
router.post("/clear", clearQueueHandler);
router.post("/autoplay", setAutoplayHandler);
router.get("/autoplay", getAutoplayStatusHandler);
router.get("/queue", getQueueHandler);
router.post("/play-position", playPositionHandler);
router.post("/remove-from-queue", removeFromQueueHandler);
router.post("/add-to-queue", addToQueueHandler);
router.post("/move-queue", moveQueueItemHandler);
router.patch("/volume", setVolumeHandler);

export default router;
