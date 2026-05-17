import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { permit } from "../middleware/permit.js";
import { tenetsController } from "../controllers/tenetsController.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get("/api/tenets", permit(PERMISSIONS.TENETS.READ), tenetsController.list);
router.get("/api/tenets/:id", permit(PERMISSIONS.TENETS.READ), tenetsController.getById);
router.post("/api/tenets", permit(PERMISSIONS.TENETS.CREATE), tenetsController.create);
router.put("/api/tenets/:id", permit(PERMISSIONS.TENETS.UPDATE), tenetsController.update);
router.delete("/api/tenets/:id", permit(PERMISSIONS.TENETS.DELETE), tenetsController.remove);
router.post(
  "/api/tenets/:id/resend-invite",
  permit(PERMISSIONS.TENETS.UPDATE),
  tenetsController.resendInvite
);

export default router;
