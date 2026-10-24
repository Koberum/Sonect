import { Router } from "express";
import {
  createProfileHandler,
  deleteProfileHandler,
  getAllProfilesHandler,
  resetProfilePasswordHandler,
  updateProfileHandler,
} from "../controllers/profileController.js";
import { requireAdmin, requireAuth } from "@middleware/auth";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", getAllProfilesHandler);
router.post("/", createProfileHandler);
router.patch("/:id", updateProfileHandler);
router.post("/:id/password", resetProfilePasswordHandler);
router.delete("/:id", deleteProfileHandler);

export default router;
