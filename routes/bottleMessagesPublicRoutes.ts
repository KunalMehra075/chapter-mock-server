import { Router } from "express";
import {
  createMessage,
  getMessageByToken,
  claimMessage,
  acknowledgeMessage,
  updateMessage,
  listSent,
  listReceived,
  listDrafts,
} from "../controllers/bottleMessagesPublicController.js";

const router = Router();

router.post("/api/bottle/messages", createMessage);
router.get("/api/bottle/messages/sent", listSent);
router.get("/api/bottle/messages/received", listReceived);
router.get("/api/bottle/messages/drafts", listDrafts);
router.get("/api/bottle/messages/by-token/:token", getMessageByToken);
router.patch("/api/bottle/messages/by-token/:token/claim", claimMessage);
router.patch(
  "/api/bottle/messages/by-token/:token/acknowledge",
  acknowledgeMessage
);
router.patch("/api/bottle/messages/:id", updateMessage);

export default router;
