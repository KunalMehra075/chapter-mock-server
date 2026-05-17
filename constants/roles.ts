import { WILDCARD } from "./permissions.js";

export const ROLES = {
  TENET: "tenet",
  OPERATOR: "operator",
  PARTNER: "partner",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const DEFAULT_ACCESS: Record<Role, string[]> = {
  [ROLES.TENET]: [WILDCARD],
  [ROLES.OPERATOR]: [
    "dashboard:*",
    "users:*",
    "orders:*",
    "analytics:*",
    "waitlist:*",
    "stats:*",
    "partners:*",
    "adminGroups:*",
  ],
  [ROLES.PARTNER]: ["orders:read", "orders:update", "analytics:read"],
};
