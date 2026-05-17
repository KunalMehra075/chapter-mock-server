import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { getPermissionsCatalog } from "../controllers/permissionsController.js";

const router = Router();

router.get("/api/permissions/catalog", authenticate, getPermissionsCatalog);

export default router;
