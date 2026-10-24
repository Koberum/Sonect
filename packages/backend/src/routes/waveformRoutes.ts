import { Router } from "express";
import { requireAuth } from "@middleware/auth";
import { getWaveformHandler } from "../controllers/waveformController";

const router = Router();

router.use(requireAuth);
router.get("/:trackId", getWaveformHandler);

export default router;
