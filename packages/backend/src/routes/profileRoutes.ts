import { Router } from "express";
import {
  createProfileHandler,
  deleteProfileHandler,
  getAllProfilesHandler,
  updateProfileHandler,
} from "../controllers/profileController.js";

const router = Router();

router.get("/", getAllProfilesHandler);
router.post("/", createProfileHandler);
router.patch("/:id", updateProfileHandler);
router.delete("/:id", deleteProfileHandler);

export default router;
