import { WILDCARD } from "../constants/permissions.js";

export const hasPermission = (
  userPermissions: string[],
  required: string
): boolean => {
  if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
    return false;
  }

  if (userPermissions.includes(WILDCARD)) return true;
  if (userPermissions.includes(required)) return true;

  const [module] = required.split(":");
  if (!module) return false;

  return userPermissions.includes(`${module}:${WILDCARD}`);
};
