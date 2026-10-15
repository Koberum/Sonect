import { Router } from "express";
import {
  getStatusHandler,
  getHealthHandler,
  getAudioDevicesHandler,
  configureAudioHandler,
  getAudioStatusHandler,
  getOutputModeHandler,
  setOutputModeHandler,
  getNetworkStatusHandler,
  getStorageSourcesHandler,
  getStorageSourceHandler,
  createStorageSourceHandler,
  updateStorageSourceHandler,
  deleteStorageSourceHandler,
  listMountsHandler,
  getDetectedLibrariesHandler,
  refreshStorageStatsHandler,
  getSetupProgressHandler,
  updateSetupProgressHandler,
  completeSetupHandler,
  resetSetupHandler,
  getMpdStatusHandler,
  getHardwareUsageHandler,
} from "../controllers/systemController";

const router = Router();

router.get("/status", getStatusHandler);
router.get("/health", getHealthHandler);

router.get("/audio/devices", getAudioDevicesHandler);
router.post("/audio/configure", configureAudioHandler);
router.get("/audio/status", getAudioStatusHandler);

router.get("/output-mode", getOutputModeHandler);
router.patch("/output-mode", setOutputModeHandler);

router.get("/network/status", getNetworkStatusHandler);

router.get("/storage/sources", getStorageSourcesHandler);
router.get("/storage/sources/:id", getStorageSourceHandler);
router.post("/storage/sources", createStorageSourceHandler);
router.patch("/storage/sources/:id", updateStorageSourceHandler);
router.delete("/storage/sources/:id", deleteStorageSourceHandler);
router.get("/storage/mounts", listMountsHandler);
router.get("/storage/detected", getDetectedLibrariesHandler);
router.post("/storage/sources/:id/refresh-stats", refreshStorageStatsHandler);

router.get("/setup/progress", getSetupProgressHandler);
router.post("/setup/progress", updateSetupProgressHandler);
router.post("/setup/complete", completeSetupHandler);
router.post("/setup/reset", resetSetupHandler);

router.get("/mpd/status", getMpdStatusHandler);

router.get("/hardware/usage", getHardwareUsageHandler);

export default router;
