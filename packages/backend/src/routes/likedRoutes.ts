import { Router } from "express";
import { requireAuth } from "@middleware/auth";
import {
  getLikedHandler,
  getLikedIdsHandler,
  likeTrackHandler,
  unlikeTrackHandler,
  playLikedHandler,
} from "../controllers/likedController";

const router = Router();

router.use(requireAuth);

router.get("/", getLikedHandler);
router.get("/ids", getLikedIdsHandler);
router.post("/play", playLikedHandler);
router.put("/:trackId", likeTrackHandler);
router.delete("/:trackId", unlikeTrackHandler);

export default router;
