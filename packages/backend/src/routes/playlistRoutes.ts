import { Router } from "express";
import { requireAuth } from "@middleware/auth";
import {
  getAllPlaylistsHandler,
  getPlaylistHandler,
  createPlaylistHandler,
  updatePlaylistHandler,
  deletePlaylistHandler,
  addTrackToPlaylistHandler,
  removeTrackFromPlaylistHandler,
  loadPlaylistHandler,
} from "../controllers/playlistController";

const router = Router();

router.use(requireAuth);

router.get("/", getAllPlaylistsHandler);
router.get("/:id", getPlaylistHandler);
router.post("/", createPlaylistHandler);
router.patch("/:id", updatePlaylistHandler);
router.delete("/:id", deletePlaylistHandler);
router.post("/:id/tracks", addTrackToPlaylistHandler);
router.delete("/:id/tracks/:trackId", removeTrackFromPlaylistHandler);
router.post("/:id/load", loadPlaylistHandler);

export default router;
