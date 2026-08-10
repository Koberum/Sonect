import { Request, Response } from "express";
import { systemSchemas } from "@repo/types";
import { asyncHandler } from "../middleware/asyncHandler";
import { getConfig, updateConfig, getConfigPath } from "../services/configService";

export const getConfigHandler = asyncHandler(async (_req: Request, res: Response) => {
  const config = getConfig();
  res.json(config);
});

export const updateConfigHandler = asyncHandler(async (req: Request, res: Response) => {
  const { content } = systemSchemas.configUpdate.parse(req.body);
  const result = updateConfig(content);
  res.json(result);
});

export const getConfigPathHandler = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ path: getConfigPath() });
});
