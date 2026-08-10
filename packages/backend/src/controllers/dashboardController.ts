import { Request, Response } from "express";
import { SuggestionService } from "../services/suggestionService";

const suggestionService = new SuggestionService();

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const currentAlbumId = req.query.excludeAlbum
    ? Number(req.query.excludeAlbum)
    : undefined;
  const data = await suggestionService.getDashboard(currentAlbumId);
  res.json(data);
}
