import { Request, Response } from "express";
import { ACTIONS, MODULES, WILDCARD } from "../constants/permissions.js";
import { DEFAULT_ACCESS, ROLES } from "../constants/roles.js";

const MODULE_LABELS: Record<string, string> = {
  [MODULES.OPERATORS]: "Operators",
  [MODULES.SUPERUSERS]: "SuperUsers",
  [MODULES.ADMINS]: "Admins",
  [MODULES.WAITLIST]: "Waitlist",
  [MODULES.STATS]: "Stats",
  [MODULES.DASHBOARD]: "Dashboard",
  [MODULES.USERS]: "Users",
  [MODULES.ORDERS]: "Orders",
  [MODULES.ANALYTICS]: "Analytics",
};

export const getPermissionsCatalog = (_req: Request, res: Response): void => {
  const actions = Object.values(ACTIONS);
  const modules = Object.values(MODULES).map((key) => ({
    key,
    label: MODULE_LABELS[key] ?? key,
    actions,
    wildcard: `${key}:${WILDCARD}`,
  }));

  res.json({
    data: {
      wildcard: WILDCARD,
      actions,
      modules,
      defaultAccess: {
        operator: DEFAULT_ACCESS[ROLES.OPERATOR],
        superuser: DEFAULT_ACCESS[ROLES.SUPERUSER],
        admin: DEFAULT_ACCESS[ROLES.ADMIN],
      },
    },
  });
};
