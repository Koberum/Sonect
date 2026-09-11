import { Request, Response } from "express";
import { systemSchemas } from "@repo/types";
import { asyncHandler } from "@middleware/asyncHandler";
import { getSystemService } from "@services/factory";
import { getAudioService } from "@services/factory";
import { getNetworkStatus } from "@services/network/networkService";
import { getStorageService } from "@services/factory";
import {
  getSetupProgress,
  isSetupComplete,
  markStepComplete,
  markStepIncomplete,
  markSetupCompleted,
  resetSetup,
  getNextIncompleteStep,
} from "@services/system/setupService";
import { NotFoundError } from "../middleware/errorHandler";

export const getStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = getSystemService().getSystemStatus();
    const setup = getSetupProgress();
    res.json({
      ...status,
      setupCompleted: setup.filter((s) => s.completed).map((s) => s.step),
    });
  },
);

export const getAudioDevicesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const devices = getAudioService().getCurrentAudioOutput();
    res.json(devices ? [devices] : []);
  },
);

export const configureAudioHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const params = systemSchemas.audioConfigure.parse(req.body);
    const result = getAudioService().configureAudioOutput(params);
    res.json(result);
  },
);

export const getAudioStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = getAudioService().getCurrentAudioOutput();
    res.json(status);
  },
);

export const getOutputModeHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const mode = getAudioService().getOutputMode();
    const deviceName = getAudioService().getOutputDeviceName();
    res.json({ mode, deviceName });
  },
);

export const setOutputModeHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { mode } = systemSchemas.outputMode.parse(req.body);
    const result = getAudioService().setOutputMode(mode);
    res.json(result);
  },
);

export const getNetworkStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = await getNetworkStatus();
    res.json(status);
  },
);

export const getStorageSourcesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const sources = await getStorageService().getStorageSourcesHandler();
    const sanitized = sources.map((s) => getStorageService().sanitizeSource(s));
    res.json(sanitized);
  },
);

export const getStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const source = getStorageService().getStorageSource(id);
    if (!source) throw new NotFoundError(`Storage source ${id}`);
    res.json(
      getStorageService().sanitizeSource(source as Record<string, unknown>),
    );
  },
);

export const createStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const data = systemSchemas.storageSource.parse(req.body);
    const source = getStorageService().createStorageSource({
      ...data,
      enabled: data.enabled ?? true,
    });
    res
      .status(201)
      .json(
        getStorageService().sanitizeSource(source as Record<string, unknown>),
      );
  },
);

export const updateStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const data = systemSchemas.storageSourceUpdate.parse(req.body);
    const source = getStorageService().updateStorageSource(id, data);
    if (!source) throw new NotFoundError(`Storage source ${id}`);
    res.json(
      getStorageService().sanitizeSource(source as Record<string, unknown>),
    );
  },
);

export const deleteStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const deleted = getStorageService().deleteStorageSource(id);
    if (!deleted) throw new NotFoundError(`Storage source ${id}`);
    res.json({ success: true });
  },
);

export const mountStorageHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const result = await getStorageService().mountSource(id);
    res.json(result);
  },
);

export const unmountStorageHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const result = await getStorageService().unmountSource(id);
    res.json(result);
  },
);

export const listMountsHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const mounts = await getStorageService().listMounts();
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

export const completeSetupHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    markSetupCompleted();
    res.json({ success: true, complete: true });
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
    const result = getAudioService().restartMPD();
    res.json(result);
  },
);

export const stopMpdHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = getAudioService().stopMPD();
    res.json(result);
  },
);

export const getMpdStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = getAudioService().getMpdStatus();
    res.json(status);
  },
);

export const getHardwareUsageHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const usage = getSystemService().getHardwareUsage();
    res.json(usage);
  },
);
