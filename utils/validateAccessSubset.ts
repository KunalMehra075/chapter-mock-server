import { hasPermission } from "./hasPermission.js";

export const validateAccessSubset = (
  granted: string[] | undefined,
  creatorAccess: string[]
): string | null => {
  if (granted === undefined) return null;
  if (!Array.isArray(granted)) return "access must be an array of strings";
  for (const perm of granted) {
    if (typeof perm !== "string" || !perm.trim()) {
      return "access entries must be non-empty strings";
    }
    if (!hasPermission(creatorAccess, perm)) {
      return `You cannot grant permission you don't possess: ${perm}`;
    }
  }
  return null;
};
