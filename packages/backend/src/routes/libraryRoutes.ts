import { Router } from "express";
import {
  getAlbums,
  getAlbumById,
  scanLibrary,
  scanImagesOnly,
  getTracksByArtist,
  getArtistById,
  getTracksByAlbum,
  getAlbumsByArtist,
  getArtists,
  getLibraryStatsHandler,
  searchHandler,
  getAllTracks,
  getRecentlyAdded,
  getGenres,
  getAlbumsByGenre,
  getTracksByGenre,
} from "../controllers/libraryController";

const router = Router();

router.get("/stats", getLibraryStatsHandler);
router.get("/search", searchHandler);
router.get("/artists", getArtists);
router.get("/artists/:id", getArtistById);
router.get("/albums", getAlbums);
router.get("/albums/:id", getAlbumById);
router.get("/albums/:albumId/tracks", getTracksByAlbum);
router.get("/artists/:artistId/tracks", getTracksByArtist);
router.get("/artists/:artistId/albums", getAlbumsByArtist);
router.get("/tracks", getAllTracks);
router.get("/recently-added", getRecentlyAdded);
router.get("/genres", getGenres);
router.get("/genres/:genre/albums", getAlbumsByGenre);
router.get("/genres/:genre/tracks", getTracksByGenre);
router.post("/scan", scanLibrary);
router.post("/sync-images", scanImagesOnly);

export default router;
