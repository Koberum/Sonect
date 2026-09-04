import { Request, Response } from "express";
import { systemSchemas } from "@repo/types";
import { asyncHandler } from "../middleware/asyncHandler";
import { getSystemStatus, getHardwareUsage } from "../services/systemService";
import {
  getAudioDevices,
  configureAudioOutput,
  getCurrentAudioOutput,
  restartMPD,
  stopMPD,
  getMpdStatus,
  setOutputMode,
  getOutputMode,
  getOutputDeviceName,
} from "../services/audioService";
import {
  scanWifi,
  connectWifi,
  disconnectWifi,
  getNetworkStatus,
  isNmcliAvailable,
} from "../services/networkService";
import {
  getStorageSources,
  getStorageSource,
  createStorageSource,
  updateStorageSource,
  deleteStorageSource,
  mountSource,
  unmountSource,
  listMounts,
  sanitizeSource,
} from "../services/storageService";
import {
  getSetupProgress,
  isSetupComplete,
  markStepComplete,
  markStepIncomplete,
  markSetupCompleted,
  resetSetup,
  getNextIncompleteStep,
} from "../services/setupService";
import { NotFoundError } from "../middleware/errorHandler";

export const getStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = getSystemStatus();
    const setup = getSetupProgress();
    res.json({
      ...status,
      setupCompleted: setup.filter((s) => s.completed).map((s) => s.step),
    });
  },
);

export const getAudioDevicesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const devices = getAudioDevices();
    res.json(devices);
  },
);

export const configureAudioHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const params = systemSchemas.audioConfigure.parse(req.body);
    const result = configureAudioOutput(params);
    res.json(result);
  },
);

export const getAudioStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = getCurrentAudioOutput();
    res.json(status);
  },
);

export const getOutputModeHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const mode = getOutputMode();
    const deviceName = getOutputDeviceName();
    res.json({ mode, deviceName });
  },
);

export const setOutputModeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { mode } = systemSchemas.outputMode.parse(req.body);
    const result = setOutputMode(mode);
    res.json(result);
  },
);

export const scanWifiHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    if (!isNmcliAvailable()) {
      res.status(400).json({ error: "nmcli is not available on this system" });
      return;
    }
    const networks = scanWifi();
    res.json(networks);
  },
);

export const connectWifiHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { ssid, password } = systemSchemas.wifiConnect.parse(req.body);
    const result = await connectWifi(ssid, password);
    res.json(result);
  },
);

export const disconnectWifiHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await disconnectWifi();
    res.json(result);
  },
);

export const getNetworkStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = getNetworkStatus();
    res.json(status);
  },
);

export const getStorageSourcesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const sources = getStorageSources().map(sanitizeSource);
    res.json(sources);
  },
);

export const getStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const source = getStorageSource(id);
    if (!source) throw new NotFoundError(`Storage source ${id}`);
    res.json(sanitizeSource(source as Record<string, unknown>));
  },
);

export const createStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const data = systemSchemas.storageSource.parse(req.body);
    const source = createStorageSource({
      ...data,
      enabled: data.enabled ?? true,
    });
    res.status(201).json(sanitizeSource(source as Record<string, unknown>));
  },
);

export const updateStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const data = systemSchemas.storageSourceUpdate.parse(req.body);
    const source = updateStorageSource(id, data);
    if (!source) throw new NotFoundError(`Storage source ${id}`);
    res.json(sanitizeSource(source as Record<string, unknown>));
  },
);

export const deleteStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const deleted = deleteStorageSource(id);
    if (!deleted) throw new NotFoundError(`Storage source ${id}`);
    res.json({ success: true });
  },
);

export const mountStorageHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const result = await mountSource(id);
    res.json(result);
  },
);

export const unmountStorageHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const result = await unmountSource(id);
    res.json(result);
  },
);

export const listMountsHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const mounts = await listMounts();
    res.json(mounts);
  },
);

export const getSetupProgressHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const progress = getSetupProgress();
    res.json({
      steps: progress,
      complete: isSetupComplete(),
      nextStep: getNextIncompleteStep(),
    });
  },
);

export const updateSetupProgressHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { step, completed } = systemSchemas.setupProgress.parse(req.body);
    if (completed) {
      markStepComplete(step);
      markSetupCompleted();
    } else {
      markStepIncomplete(step);
    }
    const progress = getSetupProgress();
    res.json({
      steps: progress,
      complete: isSetupComplete(),
      nextStep: getNextIncompleteStep(),
    });
  },
);

export const resetSetupHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    resetSetup();
    res.json({ success: true });
  },
);

export const restartMpdHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = restartMPD();
    res.json(result);
  },
);

export const stopMpdHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = stopMPD();
    res.json(result);
  },
);

export const getMpdStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = getMpdStatus();
    res.json(status);
  },
);

export const getHardwareUsageHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const usage = getHardwareUsage();
    res.json(usage);
  },
);
