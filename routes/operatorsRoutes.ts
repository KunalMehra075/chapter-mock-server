import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { permit } from "../middleware/permit.js";
import { operatorsController } from "../controllers/operatorsController.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get("/api/operators", permit(PERMISSIONS.OPERATORS.READ), operatorsController.list);
router.get("/api/operators/:id", permit(PERMISSIONS.OPERATORS.READ), operatorsController.getById);
router.post("/api/operators", permit(PERMISSIONS.OPERATORS.CREATE), operatorsController.create);
router.put("/api/operators/:id", permit(PERMISSIONS.OPERATORS.UPDATE), operatorsController.update);
router.delete("/api/operators/:id", permit(PERMISSIONS.OPERATORS.DELETE), operatorsController.remove);
router.post(
  "/api/operators/:id/resend-invite",
  permit(PERMISSIONS.OPERATORS.UPDATE),
  operatorsController.resendInvite
);

export default router;
