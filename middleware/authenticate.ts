import { Request, Response, NextFunction } from "express";
import ChapterAdmins from "../models/ChapterAdmins.js";
import { verifyAccessToken } from "../utils/jwt.js";
import "./types.js";

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    res.status(401).json({ error: "Missing access token" });
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await ChapterAdmins.findById(payload.sub);
    if (!user) {
      res.status(401).json({ error: "User no longer exists" });
      return;
    }
    if (user.mustChangePassword) {
      res
        .status(403)
        .json({ error: "Password change required before accessing this resource" });
      return;
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      role: user.role,
      access: user.access,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
