import { WILDCARD } from "./permissions.js";

export const ROLES = {
  OPERATOR: "operator",
  SUPERUSER: "superuser",
  ADMIN: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const DEFAULT_ACCESS: Record<Role, string[]> = {
  [ROLES.OPERATOR]: [WILDCARD],
  [ROLES.SUPERUSER]: [
    "dashboard:*",
    "users:*",
    "orders:*",
    "analytics:*",
    "waitlist:*",
    "stats:*",
    "admins:*",
  ],
  [ROLES.ADMIN]: ["orders:read", "orders:update", "analytics:read"],
};
