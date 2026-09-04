import { Router } from "express";
import {
  getStatusHandler,
  getAudioDevicesHandler,
  configureAudioHandler,
  getAudioStatusHandler,
  getOutputModeHandler,
  setOutputModeHandler,
  scanWifiHandler,
  connectWifiHandler,
  disconnectWifiHandler,
  getNetworkStatusHandler,
  getStorageSourcesHandler,
  getStorageSourceHandler,
  createStorageSourceHandler,
  updateStorageSourceHandler,
  deleteStorageSourceHandler,
  mountStorageHandler,
  unmountStorageHandler,
  listMountsHandler,
  getSetupProgressHandler,
  updateSetupProgressHandler,
  completeSetupHandler,
  resetSetupHandler,
  restartMpdHandler,
  stopMpdHandler,
  getMpdStatusHandler,
  getHardwareUsageHandler,
} from "../controllers/systemController";

const router = Router();

router.get("/status", getStatusHandler);

router.get("/audio/devices", getAudioDevicesHandler);
router.post("/audio/configure", configureAudioHandler);
router.get("/audio/status", getAudioStatusHandler);

router.get("/output-mode", getOutputModeHandler);
router.put("/output-mode", setOutputModeHandler);

router.get("/network/wifi/scan", scanWifiHandler);
router.post("/network/wifi/connect", connectWifiHandler);
router.post("/network/wifi/disconnect", disconnectWifiHandler);
router.get("/network/status", getNetworkStatusHandler);

router.get("/storage/sources", getStorageSourcesHandler);
router.get("/storage/sources/:id", getStorageSourceHandler);
router.post("/storage/sources", createStorageSourceHandler);
router.patch("/storage/sources/:id", updateStorageSourceHandler);
router.delete("/storage/sources/:id", deleteStorageSourceHandler);
router.post("/storage/sources/:id/mount", mountStorageHandler);
router.post("/storage/sources/:id/unmount", unmountStorageHandler);
router.get("/storage/mounts", listMountsHandler);

router.get("/setup/progress", getSetupProgressHandler);
router.post("/setup/progress", updateSetupProgressHandler);
router.post("/setup/complete", completeSetupHandler);
router.post("/setup/reset", resetSetupHandler);

router.post("/mpd/restart", restartMpdHandler);
router.post("/mpd/stop", stopMpdHandler);
router.get("/mpd/status", getMpdStatusHandler);

router.get("/hardware/usage", getHardwareUsageHandler);

export default router;
