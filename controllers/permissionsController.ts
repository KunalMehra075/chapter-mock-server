import { Request, Response } from "express";
import { ACTIONS, MODULES, WILDCARD } from "../constants/permissions.js";
import { DEFAULT_ACCESS, ROLES } from "../constants/roles.js";

const MODULE_LABELS: Record<string, string> = {
  [MODULES.TENETS]: "Tenets",
  [MODULES.OPERATORS]: "Operators",
  [MODULES.PARTNERS]: "Partners",
  [MODULES.ADMIN_GROUPS]: "Admin Groups",
  [MODULES.WAITLIST]: "Waitlist",
  [MODULES.STATS]: "Stats",
  [MODULES.DASHBOARD]: "Dashboard",
  [MODULES.USERS]: "Users",
  [MODULES.ORDERS]: "Orders",
  [MODULES.ANALYTICS]: "Analytics",
  [MODULES.BOTTLE_MESSAGES]: "Bottle Messages",
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
        tenet: DEFAULT_ACCESS[ROLES.TENET],
        operator: DEFAULT_ACCESS[ROLES.OPERATOR],
        partner: DEFAULT_ACCESS[ROLES.PARTNER],
      },
    },
  });
};
