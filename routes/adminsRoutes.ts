import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { permit } from "../middleware/permit.js";
import { adminsController } from "../controllers/adminsController.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get("/api/admins", permit(PERMISSIONS.ADMINS.READ), adminsController.list);
router.get("/api/admins/:id", permit(PERMISSIONS.ADMINS.READ), adminsController.getById);
router.post("/api/admins", permit(PERMISSIONS.ADMINS.CREATE), adminsController.create);
router.put("/api/admins/:id", permit(PERMISSIONS.ADMINS.UPDATE), adminsController.update);
router.delete("/api/admins/:id", permit(PERMISSIONS.ADMINS.DELETE), adminsController.remove);
router.post(
  "/api/admins/:id/resend-invite",
  permit(PERMISSIONS.ADMINS.UPDATE),
  adminsController.resendInvite
);

export default router;
