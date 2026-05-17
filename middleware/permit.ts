import { Request, Response, NextFunction } from "express";
import { hasPermission } from "../utils/hasPermission.js";
import "./types.js";

export const permit =
  (requiredPermission: string) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!hasPermission(req.user.access, requiredPermission)) {
      res
        .status(403)
        .json({ error: `Forbidden — missing permission: ${requiredPermission}` });
      return;
    }
    next();
  };
