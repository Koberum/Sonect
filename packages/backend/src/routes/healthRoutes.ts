import { Router } from "express";

const router = Router();

// Public, dependency-free liveness probe for the container HEALTHCHECK.
router.get("/", (_req, res) => {
  res.json({ status: "ok" });
});

export default router;
