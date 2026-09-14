import { Router } from "express";
import { getWaveformHandler } from "../controllers/waveformController";

const router = Router();

router.get("/:trackId", getWaveformHandler);

export default router;
