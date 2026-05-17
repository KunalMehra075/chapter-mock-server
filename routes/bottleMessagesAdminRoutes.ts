import { Router } from "express";
import {
  listMessages,
  getMessageById,
  createMessage,
  updateMessage,
  removeMessage,
  listUsers,
  getUserById,
  removeUser,
  getStats,
} from "../controllers/bottleMessagesAdminController.js";
import { authenticate } from "../middleware/authenticate.js";
import { permit } from "../middleware/permit.js";
import { PERMISSIONS } from "../constants/permissions.js";

const router = Router();

router.use(authenticate);

router.get(
  "/api/admin/bottle-messages/stats",
  permit(PERMISSIONS.BOTTLE_MESSAGES.READ),
  getStats
);
router.get(
  "/api/admin/bottle-messages",
  permit(PERMISSIONS.BOTTLE_MESSAGES.READ),
  listMessages
);
router.get(
  "/api/admin/bottle-messages/:id",
  permit(PERMISSIONS.BOTTLE_MESSAGES.READ),
  getMessageById
);
router.post(
  "/api/admin/bottle-messages",
  permit(PERMISSIONS.BOTTLE_MESSAGES.CREATE),
  createMessage
);
router.put(
  "/api/admin/bottle-messages/:id",
  permit(PERMISSIONS.BOTTLE_MESSAGES.UPDATE),
  updateMessage
);
router.delete(
  "/api/admin/bottle-messages/:id",
  permit(PERMISSIONS.BOTTLE_MESSAGES.DELETE),
  removeMessage
);

router.get(
  "/api/admin/bottle-message-users",
  permit(PERMISSIONS.BOTTLE_MESSAGES.READ),
  listUsers
);
router.get(
  "/api/admin/bottle-message-users/:id",
  permit(PERMISSIONS.BOTTLE_MESSAGES.READ),
  getUserById
);
router.delete(
  "/api/admin/bottle-message-users/:id",
  permit(PERMISSIONS.BOTTLE_MESSAGES.DELETE),
  removeUser
);

export default router;
