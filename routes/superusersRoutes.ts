import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { permit } from "../middleware/permit.js";
import { superusersController } from "../controllers/superusersController.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get("/api/superusers", permit(PERMISSIONS.SUPERUSERS.READ), superusersController.list);
router.get("/api/superusers/:id", permit(PERMISSIONS.SUPERUSERS.READ), superusersController.getById);
router.post("/api/superusers", permit(PERMISSIONS.SUPERUSERS.CREATE), superusersController.create);
router.put("/api/superusers/:id", permit(PERMISSIONS.SUPERUSERS.UPDATE), superusersController.update);
router.delete("/api/superusers/:id", permit(PERMISSIONS.SUPERUSERS.DELETE), superusersController.remove);
router.post(
  "/api/superusers/:id/resend-invite",
  permit(PERMISSIONS.SUPERUSERS.UPDATE),
  superusersController.resendInvite
);

export default router;
