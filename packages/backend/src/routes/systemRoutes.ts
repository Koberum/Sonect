import { Router } from "express";
import { requireAdmin, requireAuth } from "@middleware/auth";
import {
  getAudioDevicesHandler,
  configureAudioHandler,
  getAudioStatusHandler,
  getStorageSourcesHandler,
  createStorageSourceHandler,
  updateStorageSourceHandler,
  deleteStorageSourceHandler,
  getDetectedLibrariesHandler,
  getStorageStatsHandler,
  refreshStorageStatsHandler,
  getSetupProgressHandler,
  updateSetupProgressHandler,
  completeSetupHandler,
  resetSetupHandler,
  getMpdStatusHandler,
  getHardwareUsageHandler,
} from "../controllers/systemController";

const router = Router();

router.use(requireAuth, requireAdmin);

router.get("/audio/devices", getAudioDevicesHandler);
router.post("/audio/configure", configureAudioHandler);
router.get("/audio/status", getAudioStatusHandler);

router.get("/storage/sources", getStorageSourcesHandler);
router.post("/storage/sources", createStorageSourceHandler);
router.patch("/storage/sources/:id", updateStorageSourceHandler);
router.delete("/storage/sources/:id", deleteStorageSourceHandler);
router.get("/storage/detected", getDetectedLibrariesHandler);
router.get("/storage/stats", getStorageStatsHandler);
router.post("/storage/sources/:id/refresh-stats", refreshStorageStatsHandler);

router.get("/setup/progress", getSetupProgressHandler);
router.post("/setup/progress", updateSetupProgressHandler);
router.post("/setup/complete", completeSetupHandler);
router.post("/setup/reset", resetSetupHandler);

router.get("/mpd/status", getMpdStatusHandler);

router.get("/hardware/usage", getHardwareUsageHandler);

export default router;
