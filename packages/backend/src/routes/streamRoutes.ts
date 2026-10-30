import { Router } from "express";
import { requireAuth } from "@middleware/auth";
import { streamHandler } from "../controllers/streamController";
import { asyncHandler } from "../middleware/asyncHandler";

const router = Router();
router.use(requireAuth);
router.get("/:trackId", asyncHandler(streamHandler));
export default router;
