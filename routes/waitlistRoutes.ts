import { Router } from "express";
import {
  getWaitlistUsers,
  getWaitlistUserById,
  createWaitlistUser,
  updateWaitlistUser,
  deleteWaitlistUser,
} from "../controllers/waitlistController.js";
import { authenticate } from "../middleware/authenticate.js";
import { permit } from "../middleware/permit.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.post("/api/waitlist", createWaitlistUser);

router.get(
  "/api/waitlist",
  authenticate,
  permit(PERMISSIONS.WAITLIST.READ),
  getWaitlistUsers
);
router.get(
  "/api/waitlist/:id",
  authenticate,
  permit(PERMISSIONS.WAITLIST.READ),
  getWaitlistUserById
);
router.put(
  "/api/waitlist/:id",
  authenticate,
  permit(PERMISSIONS.WAITLIST.UPDATE),
  updateWaitlistUser
);
router.delete(
  "/api/waitlist/:id",
  authenticate,
  permit(PERMISSIONS.WAITLIST.DELETE),
  deleteWaitlistUser
);

export default router;
