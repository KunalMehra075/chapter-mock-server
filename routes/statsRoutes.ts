import { Router } from "express";
import { getStats } from "../controllers/statsController.js";
import { authenticate } from "../middleware/authenticate.js";
import { permit } from "../middleware/permit.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.get(
  "/api/stats",
  authenticate,
  permit(PERMISSIONS.STATS.READ),
  getStats
);

export default router;
