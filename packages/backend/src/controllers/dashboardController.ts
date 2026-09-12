import { Request, Response } from "express";
import { getSuggestionService } from "@services/factory";

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const currentAlbumId = req.query.excludeAlbum
    ? Number(req.query.excludeAlbum)
    : undefined;
  const data = getSuggestionService().getDashboard(currentAlbumId);
  res.json(data);
}
