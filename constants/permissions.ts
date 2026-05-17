export const WILDCARD = "*" as const;

export const ACTIONS = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
} as const;

export const MODULES = {
  OPERATORS: "operators",
  SUPERUSERS: "superusers",
  ADMINS: "admins",
  WAITLIST: "waitlist",
  STATS: "stats",
  DASHBOARD: "dashboard",
  USERS: "users",
  ORDERS: "orders",
  ANALYTICS: "analytics",
} as const;

type ModuleKey = (typeof MODULES)[keyof typeof MODULES];
type ActionKey = (typeof ACTIONS)[keyof typeof ACTIONS];

const perm = (m: ModuleKey, a: ActionKey): string => `${m}:${a}`;
const all = (m: ModuleKey): string => `${m}:${WILDCARD}`;

export const PERMISSIONS = {
  OPERATORS: {
    CREATE: perm(MODULES.OPERATORS, ACTIONS.CREATE),
    READ: perm(MODULES.OPERATORS, ACTIONS.READ),
    UPDATE: perm(MODULES.OPERATORS, ACTIONS.UPDATE),
    DELETE: perm(MODULES.OPERATORS, ACTIONS.DELETE),
    ALL: all(MODULES.OPERATORS),
  },
  SUPERUSERS: {
    CREATE: perm(MODULES.SUPERUSERS, ACTIONS.CREATE),
    READ: perm(MODULES.SUPERUSERS, ACTIONS.READ),
    UPDATE: perm(MODULES.SUPERUSERS, ACTIONS.UPDATE),
    DELETE: perm(MODULES.SUPERUSERS, ACTIONS.DELETE),
    ALL: all(MODULES.SUPERUSERS),
  },
  ADMINS: {
    CREATE: perm(MODULES.ADMINS, ACTIONS.CREATE),
    READ: perm(MODULES.ADMINS, ACTIONS.READ),
    UPDATE: perm(MODULES.ADMINS, ACTIONS.UPDATE),
    DELETE: perm(MODULES.ADMINS, ACTIONS.DELETE),
    ALL: all(MODULES.ADMINS),
  },
  WAITLIST: {
    CREATE: perm(MODULES.WAITLIST, ACTIONS.CREATE),
    READ: perm(MODULES.WAITLIST, ACTIONS.READ),
    UPDATE: perm(MODULES.WAITLIST, ACTIONS.UPDATE),
    DELETE: perm(MODULES.WAITLIST, ACTIONS.DELETE),
    ALL: all(MODULES.WAITLIST),
  },
  STATS: {
    READ: perm(MODULES.STATS, ACTIONS.READ),
    ALL: all(MODULES.STATS),
  },
} as const;
