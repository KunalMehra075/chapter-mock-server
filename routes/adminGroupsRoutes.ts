import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { permit } from "../middleware/permit.js";
import {
  list,
  getById,
  create,
  update,
  remove,
} from "../controllers/adminGroupsController.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get(
  "/api/admin-groups",
  permit(PERMISSIONS.ADMIN_GROUPS.READ),
  list
);
router.get(
  "/api/admin-groups/:id",
  permit(PERMISSIONS.ADMIN_GROUPS.READ),
  getById
);
router.post(
  "/api/admin-groups",
  permit(PERMISSIONS.ADMIN_GROUPS.CREATE),
  create
);
router.put(
  "/api/admin-groups/:id",
  permit(PERMISSIONS.ADMIN_GROUPS.UPDATE),
  update
);
router.delete(
  "/api/admin-groups/:id",
  permit(PERMISSIONS.ADMIN_GROUPS.DELETE),
  remove
);

export default router;
