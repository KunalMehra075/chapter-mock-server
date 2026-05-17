import { Request, Response } from "express";
import { Types } from "mongoose";
import BottleMessages from "../models/BottleMessages.js";
import BottleMessageUsers from "../models/BottleMessageUsers.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validateEmail = (email: string): boolean => EMAIL_REGEX.test(email);
const normalizeEmail = (email: string): string =>
  String(email).toLowerCase().trim();

const upsertBottleUser = async (email: string) => {
  const normalized = normalizeEmail(email);
  return BottleMessageUsers.findOneAndUpdate(
    { email: normalized },
    { $setOnInsert: { email: normalized } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

const parsePagination = (req: Request) => {
  const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit as string, 10) || 10, 1),
    100
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const buildPagination = (
  page: number,
  limit: number,
  skip: number,
  itemsLength: number,
  total: number
) => ({
  page,
  limit,
  total,
  totalPages: Math.max(Math.ceil(total / limit), 1),
  hasNextPage: skip + itemsLength < total,
  hasPrevPage: page > 1,
});

export const listMessages = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const search = ((req.query.search as string) || "").trim();
    const isDraftQuery = req.query.isDraft as string | undefined;
    const senderEmailQuery = (req.query.senderEmail as string | undefined) || "";

    const filter: Record<string, unknown> = {};
    if (search) {
      filter.$or = [
        { content: { $regex: search, $options: "i" } },
        { senderEmail: { $regex: search, $options: "i" } },
        { recipientEmail: { $regex: search, $options: "i" } },
      ];
    }
    if (isDraftQuery === "true") filter.isDraft = true;
    if (isDraftQuery === "false") filter.isDraft = false;
    if (senderEmailQuery && validateEmail(senderEmailQuery)) {
      filter.senderEmail = normalizeEmail(senderEmailQuery);
    }

    const [items, total] = await Promise.all([
      BottleMessages.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BottleMessages.countDocuments(filter),
    ]);

    res.json({
      data: items,
      pagination: buildPagination(page, limit, skip, items.length, total),
    });
  } catch (error) {
    console.error("Error listing bottle messages:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getMessageById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: "Invalid message id" });
      return;
    }
    const message = await BottleMessages.findById(req.params.id);
    if (!message) {
      res.status(404).json({ error: "Bottle message not found" });
      return;
    }
    res.json({ data: message });
  } catch (error) {
    console.error("Error fetching bottle message:", error);
    res.status(500).json({ error: "Server error" });
  }
};

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

    if (!content || !String(content).trim()) {
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

    res.status(201).json({ data: message });
  } catch (error) {
    console.error("Error creating bottle message:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: "Invalid message id" });
      return;
    }

    const { content, recipientEmail, isDraft, acknowledgedAt } = req.body as {
      content?: string;
      recipientEmail?: string | null;
      isDraft?: boolean;
      acknowledgedAt?: string | null;
    };

    const message = await BottleMessages.findById(req.params.id);
    if (!message) {
      res.status(404).json({ error: "Bottle message not found" });
      return;
    }

    if (content !== undefined) {
      if (!content || !String(content).trim()) {
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

    if (isDraft !== undefined) message.isDraft = Boolean(isDraft);

    if (acknowledgedAt !== undefined) {
      message.acknowledgedAt = acknowledgedAt ? new Date(acknowledgedAt) : null;
    }

    await message.save();
    res.json({ data: message });
  } catch (error) {
    console.error("Error updating bottle message:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const removeMessage = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: "Invalid message id" });
      return;
    }
    const message = await BottleMessages.findByIdAndDelete(req.params.id);
    if (!message) {
      res.status(404).json({ error: "Bottle message not found" });
      return;
    }
    res.json({ data: message, message: "Bottle message deleted" });
  } catch (error) {
    console.error("Error deleting bottle message:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const listUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { page, limit, skip } = parsePagination(req);
    const search = ((req.query.search as string) || "").trim();
    const filter = search
      ? {
          $or: [
            { email: { $regex: search, $options: "i" } },
            { displayName: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      BottleMessageUsers.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      BottleMessageUsers.countDocuments(filter),
    ]);

    const userEmails = items.map((u) => u.email);
    const agg = userEmails.length
      ? await BottleMessages.aggregate<{
          _id: string;
          sentCount: number;
          lastActivityAt: Date;
        }>([
          { $match: { senderEmail: { $in: userEmails } } },
          {
            $group: {
              _id: "$senderEmail",
              sentCount: { $sum: 1 },
              lastActivityAt: { $max: "$createdAt" },
            },
          },
        ])
      : [];
    const byEmail = new Map(agg.map((a) => [a._id, a]));
    const enriched = items.map((u) => ({
      ...u.toObject(),
      sentCount: byEmail.get(u.email)?.sentCount ?? 0,
      lastActivityAt: byEmail.get(u.email)?.lastActivityAt ?? null,
    }));

    res.json({
      data: enriched,
      pagination: buildPagination(page, limit, skip, items.length, total),
    });
  } catch (error) {
    console.error("Error listing bottle users:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getStats = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const [totalMessages, totalUsers, totalEmailed, totalDrafts] =
      await Promise.all([
        BottleMessages.countDocuments({}),
        BottleMessageUsers.countDocuments({}),
        BottleMessages.countDocuments({
          recipientEmail: { $ne: null },
          isDraft: false,
        }),
        BottleMessages.countDocuments({ isDraft: true }),
      ]);
    res.json({
      data: { totalMessages, totalUsers, totalEmailed, totalDrafts },
    });
  } catch (error) {
    console.error("Error fetching bottle stats:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getUserById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await BottleMessageUsers.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "Bottle user not found" });
      return;
    }
    res.json({ data: user });
  } catch (error) {
    console.error("Error fetching bottle user:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const removeUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: "Invalid user id" });
      return;
    }
    const user = await BottleMessageUsers.findByIdAndDelete(req.params.id);
    if (!user) {
      res.status(404).json({ error: "Bottle user not found" });
      return;
    }
    res.json({ data: user, message: "Bottle user deleted" });
  } catch (error) {
    console.error("Error deleting bottle user:", error);
    res.status(500).json({ error: "Server error" });
  }
};
