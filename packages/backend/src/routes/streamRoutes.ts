import { Router } from "express";
import { streamHandler } from "../controllers/streamController";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();
router.get("/{*filepath}", asyncHandler(streamHandler));
export default router;
