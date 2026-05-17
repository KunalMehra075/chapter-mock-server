import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { permit } from "../middleware/permit.js";
import { partnersController } from "../controllers/partnersController.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get("/api/partners", permit(PERMISSIONS.PARTNERS.READ), partnersController.list);
router.get("/api/partners/:id", permit(PERMISSIONS.PARTNERS.READ), partnersController.getById);
router.post("/api/partners", permit(PERMISSIONS.PARTNERS.CREATE), partnersController.create);
router.put("/api/partners/:id", permit(PERMISSIONS.PARTNERS.UPDATE), partnersController.update);
router.delete("/api/partners/:id", permit(PERMISSIONS.PARTNERS.DELETE), partnersController.remove);
router.post(
  "/api/partners/:id/resend-invite",
  permit(PERMISSIONS.PARTNERS.UPDATE),
  partnersController.resendInvite
);

export default router;
