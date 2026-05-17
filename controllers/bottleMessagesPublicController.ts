/**
 * Public controller for the message-in-a-bottle frontend.
 *
 * These endpoints are unauthenticated. The trust model intentionally matches
 * the original Supabase RLS configuration the frontend was built on: anyone
 * who supplies an email is treated as that email's owner for the purposes of
 * reading/writing their own messages. End-to-end auth (magic-link / JWT) is
 * an explicit follow-up — do not add it here without product sign-off.
 */
import { Request, Response } from "express";
import { Types } from "mongoose";
import BottleMessages, { IBottleMessage } from "../models/BottleMessages.js";
import BottleMessageUsers from "../models/BottleMessageUsers.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email: string): boolean => EMAIL_REGEX.test(email);

const normalizeEmail = (email: string): string =>
  String(email).toLowerCase().trim();

const upsertBottleUser = async (email: string) => {
  const normalized = normalizeEmail(email);
  const user = await BottleMessageUsers.findOneAndUpdate(
    { email: normalized },
    { $setOnInsert: { email: normalized } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return user;
};

const serializeMessage = (m: IBottleMessage) => ({
  id: String(m._id),
  content: m.content,
  senderEmail: m.senderEmail,
  recipientEmail: m.recipientEmail,
  isDraft: m.isDraft,
  shareableToken: m.shareableToken,
  acknowledgedAt: m.acknowledgedAt,
  createdAt: m.createdAt,
  updatedAt: m.updatedAt,
});

export const createMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { content, senderEmail, recipientEmail, isDraft } = req.body as {
      content?: string;
      senderEmail?: string;
      recipientEmail?: string | null;
      isDraft?: boolean;
    };

    if (!content || typeof content !== "string" || !content.trim()) {
      res.status(400).json({ error: "Content is required" });
      return;
    }
    if (!senderEmail || !validateEmail(senderEmail)) {
      res.status(400).json({ error: "Valid senderEmail is required" });
      return;
    }
    if (recipientEmail && !validateEmail(recipientEmail)) {
      res.status(400).json({ error: "Invalid recipientEmail format" });
      return;
    }

    const sender = await upsertBottleUser(senderEmail);
    const recipient = recipientEmail
      ? await upsertBottleUser(recipientEmail)
      : null;

    const message = await BottleMessages.create({
      content,
      senderEmail: normalizeEmail(senderEmail),
      recipientEmail: recipient ? recipient.email : null,
      senderUserId: sender._id,
      recipientUserId: recipient ? recipient._id : null,
      isDraft: Boolean(isDraft),
    });

    res.status(201).json({ data: serializeMessage(message) });
  } catch (error) {
    console.error("Error creating bottle message:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getMessageByToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const message = await BottleMessages.findOne({
      shareableToken: req.params.token,
    });
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    res.json({ data: serializeMessage(message) });
  } catch (error) {
    console.error("Error fetching bottle message:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const claimMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { recipientEmail } = req.body as { recipientEmail?: string };
    if (!recipientEmail || !validateEmail(recipientEmail)) {
      res.status(400).json({ error: "Valid recipientEmail is required" });
      return;
    }

    const message = await BottleMessages.findOne({
      shareableToken: req.params.token,
    });
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }

    const normalized = normalizeEmail(recipientEmail);

    if (message.recipientEmail && message.recipientEmail !== normalized) {
      res.status(409).json({ error: "Message already claimed by another recipient" });
      return;
    }

    if (!message.recipientEmail) {
      const recipient = await upsertBottleUser(normalized);
      message.recipientEmail = recipient.email;
      message.recipientUserId = recipient._id as Types.ObjectId;
      await message.save();
    }

    res.json({ data: serializeMessage(message) });
  } catch (error) {
    console.error("Error claiming bottle message:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const acknowledgeMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const message = await BottleMessages.findOne({
      shareableToken: req.params.token,
    });
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (!message.acknowledgedAt) {
      message.acknowledgedAt = new Date();
      await message.save();
    }
    res.json({ data: serializeMessage(message) });
  } catch (error) {
    console.error("Error acknowledging bottle message:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { content, recipientEmail, isDraft, senderEmail } = req.body as {
      content?: string;
      recipientEmail?: string | null;
      isDraft?: boolean;
      senderEmail?: string;
    };

    if (!senderEmail || !validateEmail(senderEmail)) {
      res.status(400).json({ error: "senderEmail is required to authorize update" });
      return;
    }
    if (!Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: "Invalid message id" });
      return;
    }

    const message = await BottleMessages.findById(req.params.id);
    if (!message) {
      res.status(404).json({ error: "Message not found" });
      return;
    }
    if (message.senderEmail !== normalizeEmail(senderEmail)) {
      res.status(403).json({ error: "Only the sender can update this message" });
      return;
    }

    if (content !== undefined) {
      if (!content || typeof content !== "string" || !content.trim()) {
        res.status(400).json({ error: "Content cannot be empty" });
        return;
      }
      message.content = content;
    }

    if (recipientEmail !== undefined) {
      if (recipientEmail === null || recipientEmail === "") {
        message.recipientEmail = null;
        message.recipientUserId = null;
      } else {
        if (!validateEmail(recipientEmail)) {
          res.status(400).json({ error: "Invalid recipientEmail format" });
          return;
        }
        const recipient = await upsertBottleUser(recipientEmail);
        message.recipientEmail = recipient.email;
        message.recipientUserId = recipient._id as Types.ObjectId;
      }
    }

    if (isDraft !== undefined) {
      message.isDraft = Boolean(isDraft);
    }

    await message.save();
    res.json({ data: serializeMessage(message) });
  } catch (error) {
    console.error("Error updating bottle message:", error);
    res.status(500).json({ error: "Server error" });
  }
};

const listByEmail = async (
  res: Response,
  filter: Record<string, unknown>
): Promise<void> => {
  try {
    const items = await BottleMessages.find(filter).sort({ createdAt: -1 });
    res.json({ data: items.map(serializeMessage) });
  } catch (error) {
    console.error("Error listing bottle messages:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const listSent = async (
  req: Request,
  res: Response
): Promise<void> => {
  const email = (req.query.email as string) || "";
  if (!validateEmail(email)) {
    res.status(400).json({ error: "Valid email query param is required" });
    return;
  }
  const includeDrafts =
    String(req.query.includeDrafts || "").toLowerCase() === "true";
  const filter: Record<string, unknown> = {
    senderEmail: normalizeEmail(email),
  };
  if (!includeDrafts) filter.isDraft = false;
  await listByEmail(res, filter);
};

export const listReceived = async (
  req: Request,
  res: Response
): Promise<void> => {
  const email = (req.query.email as string) || "";
  if (!validateEmail(email)) {
    res.status(400).json({ error: "Valid email query param is required" });
    return;
  }
  await listByEmail(res, {
    recipientEmail: normalizeEmail(email),
    isDraft: false,
  });
};

export const listDrafts = async (
  req: Request,
  res: Response
): Promise<void> => {
  const email = (req.query.email as string) || "";
  if (!validateEmail(email)) {
    res.status(400).json({ error: "Valid email query param is required" });
    return;
  }
  await listByEmail(res, {
    senderEmail: normalizeEmail(email),
    isDraft: true,
  });
};
