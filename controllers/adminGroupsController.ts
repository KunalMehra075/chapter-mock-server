import { Request, Response } from "express";
import { Types } from "mongoose";
import AdminGroups, { IAdminGroup } from "../models/AdminGroups.js";
import ChapterAdmins from "../models/ChapterAdmins.js";
import { Role, ROLES } from "../constants/roles.js";
import { validateAccessSubset } from "../utils/validateAccessSubset.js";
import { validateGroupRoleAuthority } from "../utils/validateGroupRoleAuthority.js";

const MEMBER_LIST_CAP = 10;

const serializeGroup = (group: IAdminGroup) => ({
  id: String(group._id),
  name: group.name,
  role: group.role,
  tags: group.tags,
  access: group.access,
  createdBy: String(group.createdBy),
  createdAt: group.createdAt,
  updatedAt: group.updatedAt,
});

const visibleRolesFor = (actorRole: Role): Role[] => {
  if (actorRole === ROLES.TENET) return [ROLES.OPERATOR, ROLES.PARTNER];
  if (actorRole === ROLES.OPERATOR) return [ROLES.PARTNER];
  return [];
};

export const list = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit as string, 10) || 20, 1),
      100
    );
    const skip = (page - 1) * limit;
    const search = ((req.query.search as string) || "").trim();
    const roleQuery = (req.query.role as string) || "";

    const allowedRoles = visibleRolesFor(req.user.role);
    if (allowedRoles.length === 0) {
      res.json({
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      });
      return;
    }

    const roleFilter =
      roleQuery && allowedRoles.includes(roleQuery as Role)
        ? [roleQuery]
        : allowedRoles;

    const filter: Record<string, unknown> = { role: { $in: roleFilter } };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      AdminGroups.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      AdminGroups.countDocuments(filter),
    ]);

    // Member count per group for the list UI.
    const groupIds = items.map((g) => g._id);
    const memberCounts = await ChapterAdmins.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      { $match: { adminGroupId: { $in: groupIds } } },
      { $group: { _id: "$adminGroupId", count: { $sum: 1 } } },
    ]);
    const countByGroup = new Map(
      memberCounts.map((m) => [String(m._id), m.count])
    );

    res.json({
      data: items.map((g) => ({
        ...serializeGroup(g),
        memberCount: countByGroup.get(String(g._id)) ?? 0,
      })),
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
    console.error("Error listing admin groups:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const group = await AdminGroups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Admin group not found" });
      return;
    }
    const allowedRoles = visibleRolesFor(req.user.role);
    if (!allowedRoles.includes(group.role as Role)) {
      res.status(403).json({ error: "Not allowed" });
      return;
    }
    res.json({ data: serializeGroup(group) });
  } catch (error) {
    console.error("Error fetching admin group:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const create = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const { name, role, tags, access } = req.body as {
      name?: string;
      role?: Role;
      tags?: string[];
      access?: string[];
    };
    if (!name || !role) {
      res.status(400).json({ error: "Name and role are required" });
      return;
    }
    if (role !== ROLES.OPERATOR && role !== ROLES.PARTNER) {
      res
        .status(400)
        .json({ error: "Role must be operator or partner" });
      return;
    }
    const authErr = validateGroupRoleAuthority(req.user.role, role);
    if (authErr) {
      res.status(403).json({ error: authErr });
      return;
    }
    const subsetErr = validateAccessSubset(access, req.user.access);
    if (subsetErr) {
      res.status(403).json({ error: subsetErr });
      return;
    }

    const group = await AdminGroups.create({
      name: name.trim(),
      role,
      tags: Array.isArray(tags)
        ? tags.map((t) => String(t).trim()).filter(Boolean)
        : [],
      access: access ?? [],
      createdBy: new Types.ObjectId(req.user.id),
    });

    res.status(201).json({ data: serializeGroup(group) });
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11000) {
      res
        .status(409)
        .json({ error: "An admin group with this name already exists for this role" });
      return;
    }
    console.error("Error creating admin group:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const update = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const existing = await AdminGroups.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: "Admin group not found" });
      return;
    }
    const authErr = validateGroupRoleAuthority(
      req.user.role,
      existing.role as Role
    );
    if (authErr) {
      res.status(403).json({ error: authErr });
      return;
    }

    const { name, tags, access } = req.body as {
      name?: string;
      tags?: string[];
      access?: string[];
    };

    if (access !== undefined) {
      const subsetErr = validateAccessSubset(access, req.user.access);
      if (subsetErr) {
        res.status(403).json({ error: subsetErr });
        return;
      }
      existing.access = access;
    }
    if (name !== undefined) existing.name = name.trim();
    if (tags !== undefined) {
      existing.tags = tags
        .map((t) => String(t).trim())
        .filter(Boolean);
    }

    await existing.save();
    res.json({ data: serializeGroup(existing) });
  } catch (error) {
    const mongoError = error as { code?: number };
    if (mongoError.code === 11000) {
      res
        .status(409)
        .json({ error: "An admin group with this name already exists for this role" });
      return;
    }
    console.error("Error updating admin group:", error);
    res.status(500).json({ error: "Server error" });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!Types.ObjectId.isValid(String(req.params.id))) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const group = await AdminGroups.findById(req.params.id);
    if (!group) {
      res.status(404).json({ error: "Admin group not found" });
      return;
    }
    const authErr = validateGroupRoleAuthority(
      req.user.role,
      group.role as Role
    );
    if (authErr) {
      res.status(403).json({ error: authErr });
      return;
    }

    const memberCount = await ChapterAdmins.countDocuments({
      adminGroupId: group._id,
    });
    if (memberCount > 0) {
      const members = await ChapterAdmins.find({ adminGroupId: group._id })
        .select("_id email role")
        .limit(MEMBER_LIST_CAP);
      res.status(409).json({
        error: "Cannot delete admin group with assigned members",
        memberCount,
        members: members.map((m) => ({
          id: String(m._id),
          email: m.email,
          role: m.role,
        })),
      });
      return;
    }

    await group.deleteOne();
    res.json({ data: serializeGroup(group), message: "Admin group deleted" });
  } catch (error) {
    console.error("Error deleting admin group:", error);
    res.status(500).json({ error: "Server error" });
  }
};
