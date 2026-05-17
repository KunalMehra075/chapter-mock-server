import jwt, { SignOptions } from "jsonwebtoken";
import { Role } from "../constants/roles.js";

export type TokenPurpose = "access" | "refresh" | "complete-invite";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
  purpose: "access";
}

export interface RefreshTokenPayload {
  sub: string;
  purpose: "refresh";
  jti: string;
}

export interface FirstLoginTokenPayload {
  sub: string;
  purpose: "complete-invite";
}

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

const accessSecret = (): string => requireEnv("JWT_ACCESS_SECRET");
const refreshSecret = (): string => requireEnv("JWT_REFRESH_SECRET");

const ACCESS_TTL = (process.env.JWT_ACCESS_TTL || "15m") as SignOptions["expiresIn"];
const REFRESH_TTL = (process.env.JWT_REFRESH_TTL || "7d") as SignOptions["expiresIn"];
const FIRST_LOGIN_TTL = (process.env.JWT_FIRST_LOGIN_TTL || "10m") as SignOptions["expiresIn"];

export const signAccessToken = (payload: Omit<AccessTokenPayload, "purpose">): string =>
  jwt.sign({ ...payload, purpose: "access" }, accessSecret(), { expiresIn: ACCESS_TTL });

export const signRefreshToken = (payload: Omit<RefreshTokenPayload, "purpose">): string =>
  jwt.sign({ ...payload, purpose: "refresh" }, refreshSecret(), { expiresIn: REFRESH_TTL });

export const signFirstLoginToken = (
  payload: Omit<FirstLoginTokenPayload, "purpose">
): string =>
  jwt.sign({ ...payload, purpose: "complete-invite" }, accessSecret(), {
    expiresIn: FIRST_LOGIN_TTL,
  });

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, accessSecret()) as AccessTokenPayload;
  if (decoded.purpose !== "access") {
    throw new Error("Invalid token purpose");
  }
  return decoded;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, refreshSecret()) as RefreshTokenPayload;
  if (decoded.purpose !== "refresh") {
    throw new Error("Invalid token purpose");
  }
  return decoded;
};

export const verifyFirstLoginToken = (token: string): FirstLoginTokenPayload => {
  const decoded = jwt.verify(token, accessSecret()) as FirstLoginTokenPayload;
  if (decoded.purpose !== "complete-invite") {
    throw new Error("Invalid token purpose");
  }
  return decoded;
};
