import { Role } from "../constants/roles.js";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  access: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
