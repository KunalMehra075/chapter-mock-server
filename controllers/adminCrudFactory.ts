import { Request, Response } from "express";
import bcrypt from "bcrypt";
import ChapterAdmins, { IChapterAdmin } from "../models/ChapterAdmins.js";
import { Role, DEFAULT_ACCESS } from "../constants/roles.js";
import { generateTempPassword } from "../utils/generatePassword.js";
import { hasPermission } from "../utils/hasPermission.js";
import {
  sendEmail,
  chapterAdminInvitationTemplate,
} from "../email/index.js";

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || "12", 10);
const INVITE_EXPIRY_HOURS = parseInt(process.env.INVITE_EXPIRY_HOURS || "24", 10);
const MIN_PASSWORD_LENGTH = 8;

const serializeAdmin = (user: IChapterAdmin) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  address: user.address,
  role: user.role,
  access: user.access,
  mustChangePassword: user.mustChangePassword,
  inviteExpiresAt: user.inviteExpiresAt,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const sendInviteEmail = async (
  user: IChapterAdmin,
  tempPassword: string
): Promise<void> => {
  const frontendUrl = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
  await sendEmail({
    to: user.email,
    subject: "You've been invited to Chapter Admin",
    html: chapterAdminInvitationTemplate({
      name: user.name,
      email: user.email,
      tempPassword,
      role: user.role,
      loginUrl: `${frontendUrl}/login`,
      expiresInHours: INVITE_EXPIRY_HOURS,
    }),
  });
};

const validateAccessSubset = (
  granted: string[] | undefined,
  creatorAccess: string[]
): string | null => {
  if (granted === undefined) return null;
  if (!Array.isArray(granted)) return "access must be an array of strings";
  for (const perm of granted) {
    if (typeof perm !== "string" || !perm.trim()) {
      return "access entries must be non-empty strings";
    }
    if (!hasPermission(creatorAccess, perm)) {
      return `You cannot grant permission you don't possess: ${perm}`;
    }
  }
  return null;
};

export const makeAdminCrudController = (role: Role) => {
  const list = async (req: Request, res: Response): Promise<void> => {
    try {
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string, 10) || 20, 1),
        100
      );
      const skip = (page - 1) * limit;
      const search = ((req.query.search as string) || "").trim();

      const filter: Record<string, unknown> = { role };
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const [items, total] = await Promise.all([
        ChapterAdmins.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit),
        ChapterAdmins.countDocuments(filter),
      ]);

      res.json({
        data: items.map(serializeAdmin),
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
      console.error(`Error listing ${role}s:`, error);
      res.status(500).json({ error: "Server error" });
    }
  };

  const getById = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await ChapterAdmins.findOne({ _id: req.params.id, role });
      if (!user) {
        res.status(404).json({ error: `${role} not found` });
        return;
      }
      res.json({ data: serializeAdmin(user) });
    } catch (error) {
      console.error(`Error fetching ${role}:`, error);
      res.status(500).json({ error: "Server error" });
    }
  };

  const create = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { name, email, password, phone, address, access } = req.body as {
        name?: string;
        email?: string;
        password?: string;
        phone?: string;
        address?: string;
        access?: string[];
      };

      if (!name || !email || !password) {
        res
          .status(400)
          .json({ error: "Name, email, and password are required" });
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        res
          .status(400)
          .json({
            error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          });
        return;
      }

      const subsetError = validateAccessSubset(access, req.user.access);
      if (subsetError) {
        res.status(403).json({ error: subsetError });
        return;
      }

      const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const inviteExpiresAt = new Date(
        Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000
      );

      const user = await ChapterAdmins.create({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashed,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        role,
        access:
          Array.isArray(access) && access.length > 0
            ? access
            : DEFAULT_ACCESS[role],
        mustChangePassword: true,
        inviteExpiresAt,
      });

      sendInviteEmail(user, password).catch((err) =>
        console.error("Failed to send invitation email:", err)
      );

      res.status(201).json({ data: serializeAdmin(user) });
    } catch (error) {
      const mongoError = error as { code?: number };
      if (mongoError.code === 11000) {
        res.status(409).json({ error: "Email already exists" });
        return;
      }
      console.error(`Error creating ${role}:`, error);
      res.status(500).json({ error: "Server error" });
    }
  };

  const update = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const { name, email, phone, address, access } = req.body as {
        name?: string;
        email?: string;
        phone?: string | null;
        address?: string | null;
        access?: string[];
      };

      const updates: Partial<
        Pick<IChapterAdmin, "name" | "email" | "phone" | "address" | "access">
      > = {};
      if (name !== undefined) updates.name = name.trim();
      if (email !== undefined) updates.email = email.toLowerCase().trim();
      if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
      if (address !== undefined)
        updates.address = address ? address.trim() : null;
      if (access !== undefined) {
        const subsetError = validateAccessSubset(access, req.user.access);
        if (subsetError) {
          res.status(403).json({ error: subsetError });
          return;
        }
        updates.access = access;
      }

      const user = await ChapterAdmins.findOneAndUpdate(
        { _id: req.params.id, role },
        updates,
        { new: true, runValidators: true }
      );
      if (!user) {
        res.status(404).json({ error: `${role} not found` });
        return;
      }
      res.json({ data: serializeAdmin(user) });
    } catch (error) {
      const mongoError = error as { code?: number };
      if (mongoError.code === 11000) {
        res.status(409).json({ error: "Email already exists" });
        return;
      }
      console.error(`Error updating ${role}:`, error);
      res.status(500).json({ error: "Server error" });
    }
  };

  const remove = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await ChapterAdmins.findOneAndDelete({
        _id: req.params.id,
        role,
      });
      if (!user) {
        res.status(404).json({ error: `${role} not found` });
        return;
      }
      res.json({ data: serializeAdmin(user), message: `${role} deleted` });
    } catch (error) {
      console.error(`Error deleting ${role}:`, error);
      res.status(500).json({ error: "Server error" });
    }
  };

  const resendInvite = async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await ChapterAdmins.findOne({ _id: req.params.id, role });
      if (!user) {
        res.status(404).json({ error: `${role} not found` });
        return;
      }
      if (!user.mustChangePassword) {
        res
          .status(409)
          .json({ error: "User has already activated; cannot resend invite" });
        return;
      }

      const tempPassword = generateTempPassword(16);
      user.password = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);
      user.inviteExpiresAt = new Date(
        Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000
      );
      await user.save();

      await sendInviteEmail(user, tempPassword);

      res.json({ data: serializeAdmin(user) });
    } catch (error) {
      console.error(`Error resending invite for ${role}:`, error);
      res.status(500).json({ error: "Server error" });
    }
  };

  return { list, getById, create, update, remove, resendInvite };
};
