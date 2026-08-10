import { Router } from "express";
import {
  getConfigHandler,
  updateConfigHandler,
  getConfigPathHandler,
} from "../controllers/configController";

const router = Router();

router.get("/config", getConfigHandler);
router.patch("/config", updateConfigHandler);
router.get("/config-path", getConfigPathHandler);

export default router;
