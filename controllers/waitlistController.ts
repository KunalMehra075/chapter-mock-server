import { Request, Response } from "express";
import WaitlistUsers from "../models/WaitlistUsers.js";
import { sendEmail, waitlistTemplate } from "../email/index.js";

const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const getWaitlistUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit as string, 10) || 10, 1),
      100
    );
    const skip = (page - 1) * limit;
    const search = ((req.query.search as string) || "").trim();

    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      WaitlistUsers.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      WaitlistUsers.countDocuments(filter),
    ]);

    res.json({
      data: items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNextPage: skip + items.length < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching waitlist users:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getWaitlistUserById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = await WaitlistUsers.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "Waitlist user not found" });
      return;
    }
    res.json({ data: user });
  } catch (error) {
    console.error("Error fetching waitlist user:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const createWaitlistUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email } = req.body as { name?: string; email?: string };
    if (!name || !email) {
      res.status(400).json({ error: "Name and email are required" });
      return;
    }
    if (!validateEmail(email)) {
      res.status(400).json({ error: "Invalid email format" });
      return;
    }

    const user = await WaitlistUsers.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
    });

    sendEmail({
      to: user.email,
      subject: "Welcome to Chapter Dev Waitlist!",
      html: waitlistTemplate({ name: user.name }),
    }).catch((err) => console.error("Failed to send waitlist email:", err));

    res.status(201).json({ data: user });
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11000) {
      res.status(409).json({ error: "Email already exists in waitlist" });
      return;
    }
    console.error("Error creating waitlist user:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const updateWaitlistUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, email } = req.body as { name?: string; email?: string };
    const update: { name?: string; email?: string } = {};
    if (name !== undefined) update.name = String(name).trim();
    if (email !== undefined) {
      if (!validateEmail(email)) {
        res.status(400).json({ error: "Invalid email format" });
        return;
      }
      update.email = String(email).toLowerCase().trim();
    }

    const user = await WaitlistUsers.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      res.status(404).json({ error: "Waitlist user not found" });
      return;
    }
    res.json({ data: user });
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11000) {
      res.status(409).json({ error: "Email already exists in waitlist" });
      return;
    }
    console.error("Error updating waitlist user:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const deleteWaitlistUser = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = await WaitlistUsers.findByIdAndDelete(req.params.id);
    if (!user) {
      res.status(404).json({ error: "Waitlist user not found" });
      return;
    }
    res.json({ data: user, message: "Waitlist user deleted" });
  } catch (error) {
    console.error("Error deleting waitlist user:", error);
    res.status(500).json({ error: "Server error" });
  }
};
