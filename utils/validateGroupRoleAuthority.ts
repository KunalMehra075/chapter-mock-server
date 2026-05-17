import { Role, ROLES } from "../constants/roles.js";

// Who can create/edit an admin group for which target role:
//   Tenet    → operator | partner
//   Operator → partner only
//   Partner  → nothing
export const validateGroupRoleAuthority = (
  actorRole: Role,
  groupRole: Role
): string | null => {
  if (actorRole === ROLES.TENET) {
    if (groupRole === ROLES.OPERATOR || groupRole === ROLES.PARTNER) return null;
    return `Cannot manage admin groups for role: ${groupRole}`;
  }
  if (actorRole === ROLES.OPERATOR) {
    if (groupRole === ROLES.PARTNER) return null;
    return "Operators can only manage admin groups for partners";
  }
  return "You are not allowed to manage admin groups";
};
