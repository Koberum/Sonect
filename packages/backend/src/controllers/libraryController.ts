import { Request, Response } from "express";
import { librarySchemas } from "@repo/types";
import * as libraryService from "../services/libraryService";
import { asyncHandler } from "../middleware/asyncHandler";
import { NotFoundError } from "../middleware/errorHandler";

export const getLibraryStatsHandler = asyncHandler(
  async (_req: Request, res: Response) => {
    const stats = await libraryService.getLibraryStats();
    res.json(stats);
  },
);

export const getArtists = asyncHandler(async (req: Request, res: Response) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;
  const [items, total] = await Promise.all([
    libraryService.getAllArtists(limit, offset),
    libraryService.getArtistCount(),
  ]);
  res.json({ items, total });
});

export const getArtistById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = librarySchemas.idParam.parse(req.params);
    const artist = await libraryService.getArtistById(id);
    if (!artist) throw new NotFoundError("Artist");
    res.json(artist);
  },
);

export const getAlbums = asyncHandler(async (req: Request, res: Response) => {
  const sort = req.query.sort as string | undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const offset = req.query.offset ? Number(req.query.offset) : undefined;
  const [items, total] = await Promise.all([
    libraryService.getAllAlbums(sort, limit, offset),
    libraryService.getAlbumCount(),
  ]);
  res.json({ items, total });
});

export const getAlbumById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = librarySchemas.idParam.parse(req.params);
    const album = await libraryService.getAlbumById(id);
    if (!album) throw new NotFoundError("Album");
    res.json(album);
  },
);

export const getAlbumsByArtist = asyncHandler(
  async (req: Request, res: Response) => {
    const { artistId } = librarySchemas.artistIdParam.parse(req.params);
    const albums = await libraryService.getAlbumsByArtist(artistId);
    res.json(albums);
  },
);

export const getTracksByAlbum = asyncHandler(
  async (req: Request, res: Response) => {
    const { albumId } = librarySchemas.albumIdParam.parse(req.params);
    const tracks = await libraryService.getTracksByAlbum(albumId);
    res.json(tracks);
  },
);

export const getTracksByArtist = asyncHandler(
  async (req: Request, res: Response) => {
    const { artistId } = librarySchemas.artistIdParam.parse(req.params);
    const tracks = await libraryService.getTracksByArtist(artistId);
    res.json(tracks);
  },
);

export const getAllTracks = asyncHandler(
  async (req: Request, res: Response) => {
    const sort = req.query.sort as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;
    const [items, total] = await Promise.all([
      libraryService.getAllTracks(sort, limit, offset),
      libraryService.getTrackCount(),
    ]);
    res.json({ items, total });
  },
);

export const getRecentlyAdded = asyncHandler(
  async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const [albums, tracks] = await Promise.all([
      libraryService.getRecentlyAddedAlbums(limit),
      libraryService.getRecentlyAddedTracks(limit),
    ]);
    res.json({ albums, tracks });
  },
);

export const getGenres = asyncHandler(async (_req: Request, res: Response) => {
  const genres = await libraryService.getGenres();
  res.json(genres);
});

export const getAlbumsByGenre = asyncHandler(
  async (req: Request, res: Response) => {
    const { genre } = librarySchemas.genreParam.parse(req.params);
    const albums = await libraryService.getAlbumsByGenre(genre);
    res.json(albums);
  },
);

export const getTracksByGenre = asyncHandler(
  async (req: Request, res: Response) => {
    const { genre } = librarySchemas.genreParam.parse(req.params);
    const tracks = await libraryService.getTracksByGenre(genre);
    res.json(tracks);
  },
);

export const searchHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const q = (req.query.q as string) || "";
    if (!q.trim()) {
      res.json({ artists: [], albums: [], tracks: [] });
      return;
    }
    const results = await libraryService.search(q);
    res.json(results);
  },
);

export const scanLibrary = asyncHandler(
  async (_req: Request, res: Response) => {
    await libraryService.scanLibrary();
    res.json({ message: "Library scan completed" });
  },
);

export const scanImagesOnly = asyncHandler(
  async (_req: Request, res: Response) => {
    await libraryService.scanImagesOnly();
    res.json({ message: "Cover sync completed" });
  },
);
