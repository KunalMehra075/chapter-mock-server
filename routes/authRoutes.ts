import { Router } from "express";
import {
  login,
  refresh,
  logout,
  completeInvite,
  me,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/authenticate.js";

const router = Router();

router.post("/api/auth/login", login);
router.post("/api/auth/refresh", refresh);
router.post("/api/auth/logout", logout);
router.post("/api/auth/complete-invite", completeInvite);
router.get("/api/auth/me", authenticate, me);
router.post("/api/auth/request-password-reset", requestPasswordReset);
router.post("/api/auth/reset-password", resetPassword);

export default router;
