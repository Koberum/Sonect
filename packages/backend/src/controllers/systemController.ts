import { Request, Response } from "express";
import { systemSchemas } from "@repo/types";
import { asyncHandler } from "@middleware/asyncHandler";
import {
  getSystemService,
  getMpdConfigService,
  getStorageService,
  getSetupService,
} from "@services/factory";
import { NotFoundError, ValidationError } from "../middleware/errorHandler";

export const getAudioDevicesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(getSystemService().detectAudioDevices());
  },
);

export const configureAudioHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const params = systemSchemas.audioConfigure.parse(req.body);
    const result = getMpdConfigService().configureAudioOutput(params);
    res.json(result);
  },
);

export const getAudioStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = getMpdConfigService().getCurrentAudioOutput();
    res.json(status);
  },
);

export const getStorageSourcesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const sources = await getStorageService().getStorageSourcesHandler();
    res.json(sources);
  },
);

export const createStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const data = systemSchemas.storageSource.parse(req.body);
    const source = await getStorageService().createStorageSource({
      ...data,
      enabled: data.enabled ?? true,
    });
    res.status(201).json(source);
  },
);

export const updateStorageSourceHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const data = systemSchemas.storageSourceUpdate.parse(req.body);
    const source = getStorageService().updateStorageSource(id, data);
    if (!source) throw new NotFoundError(`Storage source ${id}`);
    res.json(source);
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

export const getDetectedLibrariesHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json(getStorageService().getDetectedLibraries());
  },
);

export const getStorageStatsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const requestedPath =
      typeof req.query.path === "string" ? req.query.path : "";
    if (!requestedPath) {
      throw new ValidationError("Missing path query parameter", { path: "" });
    }
    res.json(await getStorageService().getStatsForPath(requestedPath));
  },
);

export const refreshStorageStatsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = systemSchemas.idParam.parse(req.params);
    const source = await getStorageService().refreshStats(id);
    if (!source) throw new NotFoundError(`Storage source ${id}`);
    res.json(source);
  },
);

export const getSetupProgressHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const progress = getSetupService().getSetupProgress();
    res.json({
      steps: progress,
      complete: getSetupService().isSetupComplete(),
      nextStep: getSetupService().getNextIncompleteStep(),
    });
  },
);

export const updateSetupProgressHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { step, completed } = systemSchemas.setupProgress.parse(req.body);
    if (completed) {
      getSetupService().markStepComplete(step);
    } else {
      getSetupService().markStepIncomplete(step);
    }
    const progress = getSetupService().getSetupProgress();
    res.json({
      steps: progress,
      complete: getSetupService().isSetupComplete(),
      nextStep: getSetupService().getNextIncompleteStep(),
    });
  },
);

export const completeSetupHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    getSetupService().markSetupCompleted();
    res.json({ success: true, complete: true });
  },
);

export const resetSetupHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    getSetupService().resetSetup();
    res.json({ success: true });
  },
);

export const getMpdStatusHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const status = getMpdConfigService().getMpdStatus();
    res.json(status);
  },
);

export const getHardwareUsageHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const usage = getSystemService().getHardwareUsage();
    res.json(usage);
  },
);
