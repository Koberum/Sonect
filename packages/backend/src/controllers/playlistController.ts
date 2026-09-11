import { Request, Response } from "express";
import { playlistSchemas } from "@repo/types";
import { getPlaylistService } from "@services/factory";
import { asyncHandler } from "@middleware/asyncHandler";
import { NotFoundError } from "@middleware/errorHandler";

export const getAllPlaylistsHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const playlists = getPlaylistService().getAllPlaylists();
    res.json(playlists);
  },
);

export const getPlaylistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = playlistSchemas.idParam.parse(req.params);
    const playlist = getPlaylistService().getPlaylistWithTracks(id);
    if (!playlist) throw new NotFoundError("Playlist");
    res.json(playlist);
  },
);

export const createPlaylistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, description } = playlistSchemas.create.parse(req.body);
    const playlist = getPlaylistService().createPlaylist(name, description);
    if (!playlist) throw new Error("Failed to create playlist");
    res.status(201).json(playlist);
  },
);

export const updatePlaylistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = playlistSchemas.idParam.parse(req.params);
    const { name, description } = playlistSchemas.update.parse(req.body);
    const playlist = getPlaylistService().updatePlaylist(id, {
      name,
      description,
    });
    if (!playlist) throw new NotFoundError("Playlist");
    res.json(playlist);
  },
);

export const deletePlaylistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = playlistSchemas.idParam.parse(req.params);
    const deleted = getPlaylistService().deletePlaylist(id);
    if (!deleted) throw new NotFoundError("Playlist");
    res.json({ message: "Playlist deleted" });
  },
);

export const addTrackToPlaylistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id: playlistId } = playlistSchemas.idParam.parse(req.params);
    const { trackId } = playlistSchemas.addTrack.parse(req.body);
    const result = getPlaylistService().addTrackToPlaylist(playlistId, trackId);
    if (!result) throw new Error("Failed to add track");
    res.status(201).json(result);
  },
);

export const removeTrackFromPlaylistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id: playlistId } = playlistSchemas.idParam.parse(req.params);
    const { trackId: playlistTrackId } = playlistSchemas.trackIdParam.parse(
      req.params,
    );
    const removed = getPlaylistService().removeTrackFromPlaylist(
      playlistTrackId,
      playlistId,
    );
    if (!removed) throw new NotFoundError("Playlist track");
    res.json({ message: "Track removed from playlist" });
  },
);

export const loadPlaylistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = playlistSchemas.idParam.parse(req.params);
    await getPlaylistService().loadPlaylist(id);
    res.json({ message: "Playlist loaded into queue" });
  },
);
