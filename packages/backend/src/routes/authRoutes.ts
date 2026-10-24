import { Router } from "express";
import {
  bootstrapHandler,
  changePasswordHandler,
  getAuthProfilesHandler,
  getAuthStateHandler,
  loginHandler,
  logoutHandler,
  switchProfileHandler,
} from "../controllers/authController";
import { requireAuth } from "@middleware/auth";

const router = Router();

router.get("/state", getAuthStateHandler);
router.get("/profiles", getAuthProfilesHandler);
router.post("/bootstrap", bootstrapHandler);
router.post("/login", loginHandler);

router.use(requireAuth);
router.post("/logout", logoutHandler);
router.post("/switch", switchProfileHandler);
router.post("/password", changePasswordHandler);

export default router;
